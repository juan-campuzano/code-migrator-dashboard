import { describe, it, expect, vi } from 'vitest';
import { AzureDevOpsAdapter, AzureDevOpsApiError } from './AzureDevOpsAdapter';
import type { RepositorySource } from '../models/types';

function makeAzureSource(token = 'test-pat'): RepositorySource {
  return { type: 'azure_devops', url: 'https://dev.azure.com/myorg/myproject/_git/myrepo', token };
}

function makeTreeResponse(items: Array<{ relativePath: string; isFolder: boolean; size?: number }>) {
  return {
    count: items.length,
    value: items.map((item) => ({
      objectId: 'abc123',
      relativePath: item.relativePath,
      gitObjectType: item.isFolder ? 'tree' : 'blob',
      size: item.size,
      isFolder: item.isFolder,
    })),
  };
}

function createMockFetch(responses: Map<string, { status: number; body?: unknown; text?: string; headers?: Record<string, string> }>) {
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
      text: async () => match.text ?? JSON.stringify(match.body),
    } as Response;
  });
}

const API_BASE = 'https://dev.azure.com/myorg/myproject/_apis/git/repositories/myrepo';
const TREE_URL = `${API_BASE}/items?recursionLevel=Full&api-version=7.0`;

describe('AzureDevOpsAdapter', () => {
  describe('successful fetch', () => {
    it('fetches tree and manifest file contents', async () => {
      const treeItems = [
        { relativePath: 'src', isFolder: true },
        { relativePath: 'src/index.ts', isFolder: false, size: 100 },
        { relativePath: 'package.json', isFolder: false, size: 250 },
        { relativePath: 'README.md', isFolder: false, size: 50 },
      ];

      const pkgContent = '{"name":"hello","dependencies":{"lodash":"^4.0.0"}}';

      const responses = new Map([
        [TREE_URL, { status: 200, body: makeTreeResponse(treeItems) }],
        [
          `${API_BASE}/items?path=${encodeURIComponent('package.json')}&api-version=7.0`,
          { status: 200, text: pkgContent },
        ],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeAzureSource());

      expect(result.fileTree).toHaveLength(4);
      expect(result.fileTree.find((e) => e.path === 'src')?.type).toBe('directory');
      expect(result.fileTree.find((e) => e.path === 'package.json')?.type).toBe('file');
      expect(result.fileTree.find((e) => e.path === 'package.json')?.size).toBe(250);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('package.json');
      expect(result.files[0].content).toBe(pkgContent);
    });

    it('fetches multiple manifest and config files', async () => {
      const treeItems = [
        { relativePath: 'package.json', isFolder: false, size: 100 },
        { relativePath: 'tsconfig.json', isFolder: false, size: 50 },
        { relativePath: 'src/app.ts', isFolder: false, size: 200 },
        { relativePath: 'Dockerfile', isFolder: false, size: 30 },
      ];

      const responses = new Map([
        [TREE_URL, { status: 200, body: makeTreeResponse(treeItems) }],
        [`${API_BASE}/items?path=${encodeURIComponent('package.json')}&api-version=7.0`, { status: 200, text: '{"name":"test"}' }],
        [`${API_BASE}/items?path=${encodeURIComponent('tsconfig.json')}&api-version=7.0`, { status: 200, text: '{"compilerOptions":{}}' }],
        [`${API_BASE}/items?path=${encodeURIComponent('Dockerfile')}&api-version=7.0`, { status: 200, text: 'FROM node:18' }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeAzureSource());

      expect(result.files).toHaveLength(3);
      const filePaths = result.files.map((f) => f.path).sort();
      expect(filePaths).toEqual(['Dockerfile', 'package.json', 'tsconfig.json']);
    });

    it('does not fetch source code files', async () => {
      const treeItems = [
        { relativePath: 'src/index.ts', isFolder: false, size: 500 },
        { relativePath: 'src/utils.ts', isFolder: false, size: 300 },
        { relativePath: 'styles/main.css', isFolder: false, size: 100 },
      ];

      const responses = new Map([
        [TREE_URL, { status: 200, body: makeTreeResponse(treeItems) }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeAzureSource());

      expect(result.fileTree).toHaveLength(3);
      expect(result.files).toHaveLength(0);
    });

    it('skips root entry with empty relativePath', async () => {
      const treeItems = [
        { relativePath: '', isFolder: true },
        { relativePath: 'src', isFolder: true },
        { relativePath: 'src/index.ts', isFolder: false, size: 100 },
      ];

      const responses = new Map([
        [TREE_URL, { status: 200, body: makeTreeResponse(treeItems) }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      const result = await adapter.fetch(makeAzureSource());

      expect(result.fileTree).toHaveLength(2);
      expect(result.fileTree.find((e) => e.path === '')).toBeUndefined();
    });

    it('sends Basic auth with base64-encoded PAT', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => makeTreeResponse([]),
        text: async () => JSON.stringify(makeTreeResponse([])),
      })) as unknown as typeof globalThis.fetch;

      const adapter = new AzureDevOpsAdapter(mockFetch);
      await adapter.fetch(makeAzureSource('my-secret-pat'));

      const expectedToken = Buffer.from(':my-secret-pat').toString('base64');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedToken}`,
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws error for non-azure_devops source type', async () => {
      const adapter = new AzureDevOpsAdapter();
      await expect(
        adapter.fetch({ type: 'local', path: '/tmp/repo' }),
      ).rejects.toThrow(/only supports azure_devops sources/);
    });

    it('throws auth error on 401 response', async () => {
      const responses = new Map([
        [TREE_URL, { status: 401, body: { message: 'Unauthorized' } }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('AUTH_ERROR');
        expect((err as AzureDevOpsApiError).message).toMatch(/authentication failed/i);
      }
    });

    it('throws auth error on 403 response', async () => {
      const responses = new Map([
        [TREE_URL, { status: 403, body: { message: 'Forbidden' } }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('AUTH_ERROR');
      }
    });

    it('throws not found error on 404 response', async () => {
      const responses = new Map([
        [TREE_URL, { status: 404, body: { message: 'Not Found' } }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('NOT_FOUND');
        expect((err as AzureDevOpsApiError).message).toMatch(/not found/i);
      }
    });

    it('throws rate limit error on 429 response with retry-after', async () => {
      const responses = new Map([
        [
          TREE_URL,
          {
            status: 429,
            body: { message: 'rate limit exceeded' },
            headers: { 'retry-after': '60' },
          },
        ],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('RATE_LIMIT_EXCEEDED');
        expect((err as AzureDevOpsApiError).retryAfter).toBe(60);
      }
    });

    it('throws rate limit error on 429 without retry-after', async () => {
      const responses = new Map([
        [TREE_URL, { status: 429, body: { message: 'rate limit exceeded' } }],
      ]);

      const adapter = new AzureDevOpsAdapter(createMockFetch(responses));
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('RATE_LIMIT_EXCEEDED');
        expect((err as AzureDevOpsApiError).retryAfter).toBeUndefined();
      }
    });

    it('throws network error when fetch fails', async () => {
      const mockFetch = vi.fn(async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof globalThis.fetch;

      const adapter = new AzureDevOpsAdapter(mockFetch);
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('NETWORK_ERROR');
        expect((err as AzureDevOpsApiError).message).toMatch(/network error/i);
      }
    });

    it('throws network error when content fetch fails', async () => {
      const treeItems = [
        { relativePath: 'package.json', isFolder: false, size: 100 },
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
            text: async () => JSON.stringify(makeTreeResponse(treeItems)),
          } as Response;
        }
        throw new TypeError('fetch failed');
      }) as unknown as typeof globalThis.fetch;

      const adapter = new AzureDevOpsAdapter(mockFetch);
      try {
        await adapter.fetch(makeAzureSource());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AzureDevOpsApiError);
        expect((err as AzureDevOpsApiError).code).toBe('NETWORK_ERROR');
      }
    });
  });
});
