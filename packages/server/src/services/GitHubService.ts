import type { FileChange } from '../models/types';

const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubService {
  private fetchFn: typeof globalThis.fetch;

  constructor(fetchFn?: typeof globalThis.fetch) {
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  /**
   * Build a branch name from a migration ID and description.
   * Pattern: migration-agent/<id>-<slug>
   * The slug contains only lowercase alphanumeric characters and hyphens.
   */
  static buildBranchName(migrationId: string, description: string): string {
    const slug = description
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `migration-agent/${migrationId}-${slug}`;
  }

  /** Get the default branch name for a repository. */
  async getDefaultBranch(params: {
    owner: string;
    repo: string;
    token: string;
  }): Promise<string> {
    const { owner, repo, token } = params;
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
    const response = await this.request(url, token);
    const data = (await response.json()) as { default_branch: string };
    return data.default_branch;
  }

  /** Create a branch from the default branch HEAD. */
  async createBranch(params: {
    owner: string;
    repo: string;
    branchName: string;
    token: string;
  }): Promise<void> {
    const { owner, repo, branchName, token } = params;

    // Get the SHA of the default branch HEAD
    const defaultBranch = await this.getDefaultBranch({ owner, repo, token });
    const refUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`;
    const refResponse = await this.request(refUrl, token);
    const refData = (await refResponse.json()) as { object: { sha: string } };
    const sha = refData.object.sha;

    // Create the new branch ref
    const createUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`;
    await this.request(createUrl, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });
  }

  /** Commit file changes to a branch. Returns the commit SHA. */
  async commitChanges(params: {
    owner: string;
    repo: string;
    branchName: string;
    token: string;
    changes: FileChange[];
    commitMessage: string;
  }): Promise<string> {
    const { owner, repo, branchName, token, changes, commitMessage } = params;

    // Get the current commit SHA for the branch
    const refUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branchName}`;
    const refResponse = await this.request(refUrl, token);
    const refData = (await refResponse.json()) as { object: { sha: string } };
    const baseCommitSha = refData.object.sha;

    // Get the tree SHA from the base commit
    const commitUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${baseCommitSha}`;
    const commitResponse = await this.request(commitUrl, token);
    const commitData = (await commitResponse.json()) as { tree: { sha: string } };
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each changed file
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    for (const change of changes) {
      const blobUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`;
      const blobResponse = await this.request(blobUrl, token, {
        method: 'POST',
        body: JSON.stringify({
          content: change.modifiedContent,
          encoding: 'utf-8',
        }),
      });
      const blobData = (await blobResponse.json()) as { sha: string };
      treeItems.push({
        path: change.filePath,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      });
    }

    // Create a new tree
    const treeUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`;
    const treeResponse = await this.request(treeUrl, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    });
    const treeData = (await treeResponse.json()) as { sha: string };

    // Create a new commit
    const newCommitUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`;
    const newCommitResponse = await this.request(newCommitUrl, token, {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [baseCommitSha],
      }),
    });
    const newCommitData = (await newCommitResponse.json()) as { sha: string };

    // Update the branch ref to point to the new commit
    const updateRefUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branchName}`;
    await this.request(updateRefUrl, token, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitData.sha }),
    });

    return newCommitData.sha;
  }

  /** Open a pull request. */
  async createPullRequest(params: {
    owner: string;
    repo: string;
    token: string;
    head: string;
    base: string;
    title: string;
    body: string;
  }): Promise<{ prUrl: string; prNumber: number }> {
    const { owner, repo, token, head, base, title, body } = params;
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`;
    const response = await this.request(url, token, {
      method: 'POST',
      body: JSON.stringify({ title, body, head, base }),
    });
    const data = (await response.json()) as { html_url: string; number: number };
    return { prUrl: data.html_url, prNumber: data.number };
  }

  /** Fetch a single file's content from a repo. Returns null if not found. */
  async getFileContent(params: {
    owner: string;
    repo: string;
    token: string;
    path: string;
    ref?: string;
  }): Promise<string | null> {
    const { owner, repo, token, path, ref } = params;
    let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const response = await this.fetchFn(url, {
      headers: this.buildHeaders(token),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as { content: string; encoding: string };
    if (data.encoding === 'base64' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  private async request(
    url: string,
    token: string,
    options?: { method?: string; body?: string },
  ): Promise<Response> {
    const response = await this.fetchFn(url, {
      method: options?.method ?? 'GET',
      headers: this.buildHeaders(token),
      body: options?.body,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = (await response.json()) as { message?: string };
        detail = errBody?.message ?? '';
      } catch {
        detail = response.statusText;
      }
      throw new Error(`GitHub API error: ${response.status} — ${detail}`);
    }

    return response;
  }
}
