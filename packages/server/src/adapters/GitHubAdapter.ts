import type { SourceAdapter, RepositorySource, FetchResult, FileEntry, FileContent } from '../models/types';
import { classifyUrl } from './urlClassifier';

const GITHUB_API_BASE = 'https://api.github.com';

/** Manifest filenames that should have their contents read */
const MANIFEST_FILES = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
]);

/** Common config files that should have their contents read */
const CONFIG_FILES = new Set([
  'tsconfig.json',
  'angular.json',
  '.babelrc',
  'babel.config.js',
  'babel.config.json',
  'webpack.config.js',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.ts',
  'nuxt.config.js',
  'vue.config.js',
  '.eslintrc.json',
  '.eslintrc.js',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.ts',
  'vitest.config.js',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'Makefile',
  'CMakeLists.txt',
  'setup.py',
  'setup.cfg',
]);

function shouldReadFile(filePath: string): boolean {
  const filename = filePath.split('/').pop() ?? '';
  return MANIFEST_FILES.has(filename) || CONFIG_FILES.has(filename);
}

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface GitHubContentResponse {
  content: string;
  encoding: string;
}

function handleRateLimitHeaders(headers: Headers): void {
  const remaining = headers.get('x-ratelimit-remaining');
  if (remaining !== null && parseInt(remaining, 10) === 0) {
    const resetHeader = headers.get('x-ratelimit-reset');
    let retryAfterMsg = '';
    if (resetHeader) {
      const resetTime = parseInt(resetHeader, 10);
      const now = Math.floor(Date.now() / 1000);
      const secondsUntilReset = Math.max(0, resetTime - now);
      retryAfterMsg = ` Rate limit resets in ${secondsUntilReset} seconds.`;
    }
    throw new GitHubApiError(
      `GitHub API rate limit exceeded.${retryAfterMsg}`,
      'RATE_LIMIT_EXCEEDED',
      resetHeader ? Math.max(0, parseInt(resetHeader, 10) - Math.floor(Date.now() / 1000)) : undefined,
    );
  }
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

async function handleResponse(response: Response): Promise<void> {
  // Check rate limit headers on every response
  handleRateLimitHeaders(response.headers);

  if (response.status === 401 || response.status === 403) {
    throw new GitHubApiError(
      'GitHub authentication failed. Please verify your access token is valid and not expired.',
      'AUTH_ERROR',
    );
  }

  if (response.status === 404) {
    throw new GitHubApiError(
      'Repository not found. The repository may not exist or your access token may lack permission to access it.',
      'NOT_FOUND',
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
    throw new GitHubApiError(
      `GitHub API rate limit exceeded.${retrySeconds ? ` Retry after ${retrySeconds} seconds.` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      retrySeconds,
    );
  }

  if (!response.ok) {
    throw new GitHubApiError(
      `GitHub API request failed with status ${response.status}.`,
      'API_ERROR',
    );
  }
}

export class GitHubAdapter implements SourceAdapter {
  private fetchFn: typeof globalThis.fetch;

  constructor(fetchFn?: typeof globalThis.fetch) {
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async fetch(source: RepositorySource): Promise<FetchResult> {
    if (source.type !== 'github') {
      throw new Error(`GitHubAdapter only supports github sources, got '${source.type}'`);
    }

    const classification = classifyUrl(source.url);
    if (classification.type !== 'github') {
      throw new Error(`URL is not a GitHub repository URL: ${source.url}`);
    }

    const { owner, repo } = classification;
    const headers = {
      Authorization: `Bearer ${source.token}`,
      Accept: 'application/vnd.github.v3+json',
    };

    // 1. Fetch the repository tree
    const fileTree: FileEntry[] = [];
    const treeUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;

    let treeResponse: Response;
    try {
      treeResponse = await this.fetchFn(treeUrl, { headers });
    } catch (err: unknown) {
      if (err instanceof GitHubApiError) throw err;
      throw new GitHubApiError(
        'Network error while connecting to GitHub API. Please verify your internet connectivity.',
        'NETWORK_ERROR',
      );
    }

    await handleResponse(treeResponse);
    const treeData = await treeResponse.json() as GitHubTreeResponse;

    // Build file tree entries
    const filesToFetch: string[] = [];
    for (const item of treeData.tree) {
      if (item.type === 'tree') {
        fileTree.push({ path: item.path, type: 'directory' });
      } else if (item.type === 'blob') {
        fileTree.push({ path: item.path, type: 'file', size: item.size });
        if (shouldReadFile(item.path)) {
          filesToFetch.push(item.path);
        }
      }
    }

    // 2. Fetch contents of manifest/config files
    const files: FileContent[] = [];
    for (const filePath of filesToFetch) {
      const contentUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filePath}`;
      let contentResponse: Response;
      try {
        contentResponse = await this.fetchFn(contentUrl, { headers });
      } catch (err: unknown) {
        if (err instanceof GitHubApiError) throw err;
        throw new GitHubApiError(
          'Network error while connecting to GitHub API. Please verify your internet connectivity.',
          'NETWORK_ERROR',
        );
      }

      await handleResponse(contentResponse);
      const contentData = await contentResponse.json() as GitHubContentResponse;

      if (contentData.encoding === 'base64' && contentData.content) {
        const decoded = Buffer.from(contentData.content, 'base64').toString('utf-8');
        files.push({ path: filePath, content: decoded });
      }
    }

    return { fileTree, files };
  }
}
