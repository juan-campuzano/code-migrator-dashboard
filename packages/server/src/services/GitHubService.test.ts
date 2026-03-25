import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { GitHubService } from './GitHubService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFetch(
  responses: Map<string, { status: number; body: unknown }>,
) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    // Match by prefix for URLs that may have query params
    let match: { status: number; body: unknown } | undefined;
    for (const [key, val] of responses) {
      if (urlStr === key || urlStr.startsWith(key)) {
        match = val;
        break;
      }
    }
    if (!match) {
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    }
    return {
      ok: match.status >= 200 && match.status < 300,
      status: match.status,
      headers: new Headers(),
      json: async () => match!.body,
    } as Response;
  });
}

const BASE = 'https://api.github.com';
const OWNER = 'octocat';
const REPO = 'hello-world';
const TOKEN = 'test-token';

// ---------------------------------------------------------------------------
// Unit Tests (Task 3.2)
// ---------------------------------------------------------------------------

describe('GitHubService', () => {
  describe('getDefaultBranch', () => {
    it('returns the default branch name', async () => {
      const responses = new Map([
        [`${BASE}/repos/${OWNER}/${REPO}`, { status: 200, body: { default_branch: 'main' } }],
      ]);
      const svc = new GitHubService(createMockFetch(responses));
      const branch = await svc.getDefaultBranch({ owner: OWNER, repo: REPO, token: TOKEN });
      expect(branch).toBe('main');
    });

    it('sends correct authorization header', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ default_branch: 'main' }),
      })) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      await svc.getDefaultBranch({ owner: OWNER, repo: REPO, token: 'my-token' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE}/repos/${OWNER}/${REPO}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });
  });

  describe('createBranch', () => {
    it('creates a branch from the default branch HEAD', async () => {
      const mockFetch = vi.fn()
        // getDefaultBranch → repo info
        .mockResolvedValueOnce({
          ok: true, status: 200, headers: new Headers(),
          json: async () => ({ default_branch: 'main' }),
        })
        // get ref for default branch
        .mockResolvedValueOnce({
          ok: true, status: 200, headers: new Headers(),
          json: async () => ({ object: { sha: 'abc123' } }),
        })
        // create ref
        .mockResolvedValueOnce({
          ok: true, status: 201, headers: new Headers(),
          json: async () => ({ ref: 'refs/heads/my-branch' }),
        }) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      await svc.createBranch({ owner: OWNER, repo: REPO, branchName: 'my-branch', token: TOKEN });

      // Verify the create ref call
      const createCall = mockFetch.mock.calls[2];
      expect(createCall[0]).toBe(`${BASE}/repos/${OWNER}/${REPO}/git/refs`);
      const body = JSON.parse(createCall[1].body as string);
      expect(body.ref).toBe('refs/heads/my-branch');
      expect(body.sha).toBe('abc123');
    });

    it('throws on API error', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200, headers: new Headers(),
          json: async () => ({ default_branch: 'main' }),
        })
        .mockResolvedValueOnce({
          ok: false, status: 404, headers: new Headers(),
          json: async () => ({ message: 'Not Found' }),
        }) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      await expect(
        svc.createBranch({ owner: OWNER, repo: REPO, branchName: 'my-branch', token: TOKEN }),
      ).rejects.toThrow('GitHub API error: 404');
    });
  });

  describe('commitChanges', () => {
    it('creates blobs, tree, commit, and updates ref', async () => {
      const mockFetch = vi.fn()
        // get branch ref
        .mockResolvedValueOnce({
          ok: true, status: 200, headers: new Headers(),
          json: async () => ({ object: { sha: 'branch-sha' } }),
        })
        // get commit (for tree sha)
        .mockResolvedValueOnce({
          ok: true, status: 200, headers: new Headers(),
          json: async () => ({ tree: { sha: 'base-tree-sha' } }),
        })
        // create blob
        .mockResolvedValueOnce({
          ok: true, status: 201, headers: new Headers(),
          json: async () => ({ sha: 'blob-sha-1' }),
        })
        // create tree
        .mockResolvedValueOnce({
          ok: true, status: 201, headers: new Headers(),
          json: async () => ({ sha: 'new-tree-sha' }),
        })
        // create commit
        .mockResolvedValueOnce({
          ok: true, status: 201, headers: new Headers(),
          json: async () => ({ sha: 'new-commit-sha' }),
        })
        // update ref
        .mockResolvedValueOnce({
          ok: true, status: 200, headers: new Headers(),
          json: async () => ({ object: { sha: 'new-commit-sha' } }),
        }) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      const sha = await svc.commitChanges({
        owner: OWNER,
        repo: REPO,
        branchName: 'my-branch',
        token: TOKEN,
        changes: [
          { filePath: 'package.json', originalContent: '{}', modifiedContent: '{"v":1}' },
        ],
        commitMessage: 'Upgrade deps',
      });

      expect(sha).toBe('new-commit-sha');
      expect(mockFetch).toHaveBeenCalledTimes(6);

      // Verify blob creation
      const blobCall = mockFetch.mock.calls[2];
      expect(blobCall[0]).toBe(`${BASE}/repos/${OWNER}/${REPO}/git/blobs`);
      const blobBody = JSON.parse(blobCall[1].body as string);
      expect(blobBody.content).toBe('{"v":1}');

      // Verify commit message
      const commitCall = mockFetch.mock.calls[4];
      const commitBody = JSON.parse(commitCall[1].body as string);
      expect(commitBody.message).toBe('Upgrade deps');
      expect(commitBody.parents).toEqual(['branch-sha']);
    });
  });

  describe('createPullRequest', () => {
    it('creates a PR and returns url and number', async () => {
      const responses = new Map([
        [
          `${BASE}/repos/${OWNER}/${REPO}/pulls`,
          {
            status: 201,
            body: {
              html_url: 'https://github.com/octocat/hello-world/pull/42',
              number: 42,
            },
          },
        ],
      ]);
      const svc = new GitHubService(createMockFetch(responses));
      const result = await svc.createPullRequest({
        owner: OWNER,
        repo: REPO,
        token: TOKEN,
        head: 'my-branch',
        base: 'main',
        title: 'Upgrade deps',
        body: 'PR body',
      });

      expect(result.prUrl).toBe('https://github.com/octocat/hello-world/pull/42');
      expect(result.prNumber).toBe(42);
    });

    it('sends correct PR payload', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true, status: 201, headers: new Headers(),
        json: async () => ({ html_url: 'https://example.com/pr/1', number: 1 }),
      })) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      await svc.createPullRequest({
        owner: OWNER, repo: REPO, token: TOKEN,
        head: 'feature', base: 'main', title: 'My PR', body: 'Description',
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body).toEqual({ title: 'My PR', body: 'Description', head: 'feature', base: 'main' });
    });
  });

  describe('getFileContent', () => {
    it('returns decoded file content', async () => {
      const content = 'Hello, world!';
      const responses = new Map([
        [
          `${BASE}/repos/${OWNER}/${REPO}/contents/README.md`,
          {
            status: 200,
            body: {
              content: Buffer.from(content).toString('base64'),
              encoding: 'base64',
            },
          },
        ],
      ]);
      const svc = new GitHubService(createMockFetch(responses));
      const result = await svc.getFileContent({
        owner: OWNER, repo: REPO, token: TOKEN, path: 'README.md',
      });
      expect(result).toBe(content);
    });

    it('returns null when file is not found (404)', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false, status: 404, headers: new Headers(),
        json: async () => ({ message: 'Not Found' }),
      })) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      const result = await svc.getFileContent({
        owner: OWNER, repo: REPO, token: TOKEN, path: '.migration-agent.md',
      });
      expect(result).toBeNull();
    });

    it('includes ref query parameter when provided', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true, status: 200, headers: new Headers(),
        json: async () => ({
          content: Buffer.from('data').toString('base64'),
          encoding: 'base64',
        }),
      })) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      await svc.getFileContent({
        owner: OWNER, repo: REPO, token: TOKEN, path: 'file.txt', ref: 'develop',
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('?ref=develop');
    });

    it('throws on non-404 error', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false, status: 500, headers: new Headers(),
        json: async () => ({ message: 'Server Error' }),
      })) as unknown as typeof globalThis.fetch;

      const svc = new GitHubService(mockFetch);
      await expect(
        svc.getFileContent({ owner: OWNER, repo: REPO, token: TOKEN, path: 'file.txt' }),
      ).rejects.toThrow('GitHub API error: 500');
    });
  });

  describe('buildBranchName', () => {
    it('builds correct branch name from id and description', () => {
      const name = GitHubService.buildBranchName('abc-123', 'Upgrade Express');
      expect(name).toBe('migration-agent/abc-123-upgrade-express');
    });

    it('strips non-URL-safe characters', () => {
      const name = GitHubService.buildBranchName('id-1', 'Hello World! @#$%');
      expect(name).toBe('migration-agent/id-1-hello-world');
    });

    it('collapses multiple hyphens', () => {
      const name = GitHubService.buildBranchName('id-1', 'a---b');
      expect(name).toBe('migration-agent/id-1-a-b');
    });

    it('handles empty description', () => {
      const name = GitHubService.buildBranchName('id-1', '');
      expect(name).toBe('migration-agent/id-1-');
    });
  });
});


// ---------------------------------------------------------------------------
// Property-Based Tests (Task 3.3)
// Feature: background-migration-agent, Property 4: Branch name follows naming pattern
// ---------------------------------------------------------------------------

describe('GitHubService - Property Tests', () => {
  /**
   * Property 4: Branch name follows naming pattern
   * For any migration ID (UUID) and short description string, the created
   * branch name should match the pattern migration-agent/<id>-<slug> with
   * only safe characters (lowercase alphanumeric and hyphens in the slug).
   *
   * **Validates: Requirements 4.1**
   */
  it('Property 4: branch name always matches migration-agent/<id>-<slug> with safe characters', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 0, maxLength: 100 }),
        (migrationId, description) => {
          const branchName = GitHubService.buildBranchName(migrationId, description);

          // Must start with the prefix
          expect(branchName.startsWith('migration-agent/')).toBe(true);

          // Extract the part after the prefix
          const afterPrefix = branchName.slice('migration-agent/'.length);

          // Must start with the migration ID followed by a hyphen
          expect(afterPrefix.startsWith(`${migrationId}-`)).toBe(true);

          // Extract the slug (after id-)
          const slug = afterPrefix.slice(migrationId.length + 1);

          // Slug must contain only lowercase alphanumeric and hyphens
          expect(slug).toMatch(/^[a-z0-9-]*$/);

          // Slug must not contain consecutive hyphens
          expect(slug).not.toMatch(/--/);
        },
      ),
      { numRuns: 100 },
    );
  });
});
