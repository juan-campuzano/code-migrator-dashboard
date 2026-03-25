import { describe, it, expect, vi } from 'vitest';
import { GitHubAdapter, GitHubApiError } from './GitHubAdapter';
import type { RepositorySource } from '../models/types';

function makeGithubSource(token = 'test-token'): RepositorySource {
  return { type: 'github', url: 'https://github.com/octocat/hello-world', token };
}

function makeTreeResponse(items: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>) {
  return {
    sha: 'abc123',
    url: 'https://api.github.com/repos/octocat/hello-world/git/trees/abc123',
    tree: items.map((item) => ({
      ...item,
      mode: item.type === 'tree' ? '040000' : '100644',
      sha: 'deadbeef',
      url: `https://api.github.com/git/${item.type}s/deadbeef`,
    })),
    truncated: false,
  };
}

function makeContentResponse(content: string) {
  return {
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64',
  };
}

function createMockFetch(responses: Map<string, { status: number; body: unknown; headers?: Record<string, string> }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const match = responses.get(urlStr);
    if (!match) {
      throw new Error(`Unexpected fetch URL: ${urlStr}`);
    }
    return {
      ok: match.status >= 200 && match.status < 300,
      status: match.status,
      headers: new Headers(match.headers ?? {}),
      json: async () => match.body,
    } as Response;
  });
}

describe('GitHubAdapter', () => {
  describe('successful fetch', () => {
    it('fetches tree and manifest file contents', async () => {
      const treeItems = [
        { path: 'src', type: 'tree' as const },
        { path: 'src/index.ts', type: 'blob' as const, size: 100 },
        { path: 'package.json', type: 'blob' as const, size: 250 },
        { path: 'README.md', type: 'blob' as const, size: 50 },
      ];

      const pkgContent = '{"name":"hello","dependencies":{"lodash":"^4.0.0"}}';

      const responses = new Map<string, { status: number; body: unknown; headers?: Record<string, string> }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          { status: 200, body: makeTreeResponse(treeItems) },
        ],
        [
          'https://api.github.com/repos/octocat/hello-world/contents/package.json',
          { status: 200, body: makeContentResponse(pkgContent) },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeGithubSource());

      // File tree should contain all items
      expect(result.fileTree).toHaveLength(4);
      expect(result.fileTree.find((e) => e.path === 'src')?.type).toBe('directory');
      expect(result.fileTree.find((e) => e.path === 'package.json')?.type).toBe('file');
      expect(result.fileTree.find((e) => e.path === 'package.json')?.size).toBe(250);

      // Only manifest/config files should be fetched
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('package.json');
      expect(result.files[0].content).toBe(pkgContent);
    });

    it('fetches multiple manifest and config files', async () => {
      const treeItems = [
        { path: 'package.json', type: 'blob' as const, size: 100 },
        { path: 'tsconfig.json', type: 'blob' as const, size: 50 },
        { path: 'src/app.ts', type: 'blob' as const, size: 200 },
        { path: 'Dockerfile', type: 'blob' as const, size: 30 },
      ];

      const responses = new Map<string, { status: number; body: unknown }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          { status: 200, body: makeTreeResponse(treeItems) },
        ],
        [
          'https://api.github.com/repos/octocat/hello-world/contents/package.json',
          { status: 200, body: makeContentResponse('{"name":"test"}') },
        ],
        [
          'https://api.github.com/repos/octocat/hello-world/contents/tsconfig.json',
          { status: 200, body: makeContentResponse('{"compilerOptions":{}}') },
        ],
        [
          'https://api.github.com/repos/octocat/hello-world/contents/Dockerfile',
          { status: 200, body: makeContentResponse('FROM node:18') },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeGithubSource());

      expect(result.files).toHaveLength(3);
      const filePaths = result.files.map((f) => f.path).sort();
      expect(filePaths).toEqual(['Dockerfile', 'package.json', 'tsconfig.json']);
    });

    it('does not fetch source code files', async () => {
      const treeItems = [
        { path: 'src/index.ts', type: 'blob' as const, size: 500 },
        { path: 'src/utils.ts', type: 'blob' as const, size: 300 },
        { path: 'styles/main.css', type: 'blob' as const, size: 100 },
      ];

      const responses = new Map<string, { status: number; body: unknown }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          { status: 200, body: makeTreeResponse(treeItems) },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeGithubSource());

      expect(result.fileTree).toHaveLength(3);
      expect(result.files).toHaveLength(0);
    });

    it('sends Bearer token in Authorization header', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => makeTreeResponse([]),
      })) as unknown as typeof globalThis.fetch;

      const adapter = new GitHubAdapter(mockFetch);
      await adapter.fetch(makeGithubSource('my-secret-token'));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-token',
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws error for non-github source type', async () => {
      const adapter = new GitHubAdapter();
      await expect(
        adapter.fetch({ type: 'local', path: '/tmp/repo' }),
      ).rejects.toThrow(/only supports github sources/);
    });

    it('throws auth error on 401 response', async () => {
      const responses = new Map<string, { status: number; body: unknown }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          { status: 401, body: { message: 'Bad credentials' } },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('AUTH_ERROR');
        expect((err as GitHubApiError).message).toMatch(/authentication failed/i);
      }
    });

    it('throws auth error on 403 response', async () => {
      const responses = new Map<string, { status: number; body: unknown }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          { status: 403, body: { message: 'Forbidden' } },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('AUTH_ERROR');
      }
    });

    it('throws not found error on 404 response', async () => {
      const responses = new Map<string, { status: number; body: unknown }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          { status: 404, body: { message: 'Not Found' } },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('NOT_FOUND');
        expect((err as GitHubApiError).message).toMatch(/not found/i);
      }
    });

    it('throws rate limit error on 429 response with retry-after', async () => {
      const responses = new Map<string, { status: number; body: unknown; headers?: Record<string, string> }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          {
            status: 429,
            body: { message: 'rate limit exceeded' },
            headers: { 'retry-after': '60' },
          },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('RATE_LIMIT_EXCEEDED');
        expect((err as GitHubApiError).retryAfter).toBe(60);
      }
    });

    it('throws rate limit error when X-RateLimit-Remaining is 0', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 120;
      const responses = new Map<string, { status: number; body: unknown; headers?: Record<string, string> }>([
        [
          'https://api.github.com/repos/octocat/hello-world/git/trees/HEAD?recursive=1',
          {
            status: 200,
            body: makeTreeResponse([]),
            headers: {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(resetTime),
            },
          },
        ],
      ]);

      const adapter = new GitHubAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('RATE_LIMIT_EXCEEDED');
        expect((err as GitHubApiError).retryAfter).toBeGreaterThan(0);
      }
    });

    it('throws network error when fetch fails', async () => {
      const mockFetch = vi.fn(async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof globalThis.fetch;

      const adapter = new GitHubAdapter(mockFetch);
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('NETWORK_ERROR');
        expect((err as GitHubApiError).message).toMatch(/network error/i);
      }
    });

    it('throws network error when content fetch fails', async () => {
      const treeItems = [
        { path: 'package.json', type: 'blob' as const, size: 100 },
      ];

      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => makeTreeResponse(treeItems),
          } as Response;
        }
        throw new TypeError('fetch failed');
      }) as unknown as typeof globalThis.fetch;

      const adapter = new GitHubAdapter(mockFetch);
      try {
        await adapter.fetch(makeGithubSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubApiError);
        expect((err as GitHubApiError).code).toBe('NETWORK_ERROR');
      }
    });
  });
});
