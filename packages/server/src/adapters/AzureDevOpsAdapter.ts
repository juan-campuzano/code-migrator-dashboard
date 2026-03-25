import type { SourceAdapter, RepositorySource, FetchResult, FileEntry, FileContent } from '../models/types';
import { classifyUrl } from './urlClassifier';

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

interface AzureDevOpsTreeItem {
  objectId: string;
  relativePath: string;
  gitObjectType: 'blob' | 'tree';
  size?: number;
  isFolder: boolean;
}

interface AzureDevOpsTreeResponse {
  count: number;
  value: AzureDevOpsTreeItem[];
}

export class AzureDevOpsApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'AzureDevOpsApiError';
  }
}

async function handleResponse(response: Response): Promise<void> {
  if (response.status === 401 || response.status === 403) {
    throw new AzureDevOpsApiError(
      'Azure DevOps authentication failed. Please verify your access token is valid and not expired.',
      'AUTH_ERROR',
    );
  }

  if (response.status === 404) {
    throw new AzureDevOpsApiError(
      'Repository not found. The repository may not exist or your access token may lack permission to access it.',
      'NOT_FOUND',
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
    throw new AzureDevOpsApiError(
      `Azure DevOps API rate limit exceeded.${retrySeconds ? ` Retry after ${retrySeconds} seconds.` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      retrySeconds,
    );
  }

  if (!response.ok) {
    throw new AzureDevOpsApiError(
      `Azure DevOps API request failed with status ${response.status}.`,
      'API_ERROR',
    );
  }
}

export class AzureDevOpsAdapter implements SourceAdapter {
  private fetchFn: typeof globalThis.fetch;

  constructor(fetchFn?: typeof globalThis.fetch) {
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async fetch(source: RepositorySource): Promise<FetchResult> {
    if (source.type !== 'azure_devops') {
      throw new Error(`AzureDevOpsAdapter only supports azure_devops sources, got '${source.type}'`);
    }

    const classification = classifyUrl(source.url);
    if (classification.type !== 'azure_devops') {
      throw new Error(`URL is not an Azure DevOps repository URL: ${source.url}`);
    }

    const { org, project, repo } = classification;
    const encodedToken = Buffer.from(`:${source.token}`).toString('base64');
    const headers = {
      Authorization: `Basic ${encodedToken}`,
      Accept: 'application/json',
    };

    const apiBase = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}`;

    // 1. Fetch the repository tree
    const treeUrl = `${apiBase}/items?recursionLevel=Full&api-version=7.0`;

    let treeResponse: Response;
    try {
      treeResponse = await this.fetchFn(treeUrl, { headers });
    } catch (err: unknown) {
      if (err instanceof AzureDevOpsApiError) throw err;
      throw new AzureDevOpsApiError(
        'Network error while connecting to Azure DevOps API. Please verify your internet connectivity.',
        'NETWORK_ERROR',
      );
    }

    await handleResponse(treeResponse);
    const treeData = (await treeResponse.json()) as AzureDevOpsTreeResponse;

    // Build file tree entries
    const fileTree: FileEntry[] = [];
    const filesToFetch: string[] = [];

    for (const item of treeData.value) {
      // Skip the root entry (empty relativePath)
      if (!item.relativePath) continue;

      if (item.isFolder) {
        fileTree.push({ path: item.relativePath, type: 'directory' });
      } else {
        fileTree.push({ path: item.relativePath, type: 'file', size: item.size });
        if (shouldReadFile(item.relativePath)) {
          filesToFetch.push(item.relativePath);
        }
      }
    }

    // 2. Fetch contents of manifest/config files
    const files: FileContent[] = [];
    for (const filePath of filesToFetch) {
      const contentUrl = `${apiBase}/items?path=${encodeURIComponent(filePath)}&api-version=7.0`;

      let contentResponse: Response;
      try {
        contentResponse = await this.fetchFn(contentUrl, {
          headers: { ...headers, Accept: 'application/octet-stream' },
        });
      } catch (err: unknown) {
        if (err instanceof AzureDevOpsApiError) throw err;
        throw new AzureDevOpsApiError(
          'Network error while connecting to Azure DevOps API. Please verify your internet connectivity.',
          'NETWORK_ERROR',
        );
      }

      await handleResponse(contentResponse);
      const content = await contentResponse.text();
      files.push({ path: filePath, content });
    }

    return { fileTree, files };
  }
}
