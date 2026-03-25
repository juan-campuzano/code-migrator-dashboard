import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { createIngestionRouter } from './ingestionRoutes';
import type { IngestionService } from '../services/IngestionService';
import type { TokenService } from '../services/TokenService';
import type { IngestionRecord } from '../models/types';

// --- Helpers ---

function createMockIngestionService(overrides: Partial<IngestionService> = {}) {
  return {
    startIngestion: vi.fn().mockResolvedValue('ing-001'),
    getIngestionStatus: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as IngestionService;
}

function createMockTokenService(overrides: Partial<TokenService> = {}) {
  return {
    getToken: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as TokenService;
}

function startApp(ingestionService: IngestionService, tokenService: TokenService) {
  const app = express();
  app.use(express.json());
  app.use('/api/ingestions', createIngestionRouter(ingestionService, tokenService));

  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// --- Tests ---

describe('ingestionRoutes', () => {
  describe('POST /api/ingestions', () => {
    it('returns 400 when body has no source', async () => {
      const svc = createMockIngestionService();
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('source');
      } finally {
        server.close();
      }
    });

    it('returns 400 for invalid source type', async () => {
      const svc = createMockIngestionService();
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { type: 'bitbucket' } }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('bitbucket');
      } finally {
        server.close();
      }
    });

    it('returns 400 when local source has no path', async () => {
      const svc = createMockIngestionService();
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { type: 'local' } }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('path');
      } finally {
        server.close();
      }
    });

    it('returns 400 when github source has no url', async () => {
      const svc = createMockIngestionService();
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { type: 'github' } }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('url');
      } finally {
        server.close();
      }
    });

    it('returns 400 with AUTH_MISSING_TOKEN when no token configured for remote source', async () => {
      const svc = createMockIngestionService();
      const tokenSvc = createMockTokenService({ getToken: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { type: 'github', url: 'https://github.com/o/r' } }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('AUTH_MISSING_TOKEN');
        expect(body.provider).toBe('github');
      } finally {
        server.close();
      }
    });

    it('returns 202 with ingestionId for valid local source', async () => {
      const svc = createMockIngestionService({ startIngestion: vi.fn().mockResolvedValue('ing-123') });
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { type: 'local', path: '/tmp/repo' } }),
        });
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.ingestionId).toBe('ing-123');
        expect(svc.startIngestion).toHaveBeenCalledWith({
          source: { type: 'local', path: '/tmp/repo' },
        });
      } finally {
        server.close();
      }
    });

    it('returns 202 for github source with token from request', async () => {
      const svc = createMockIngestionService({ startIngestion: vi.fn().mockResolvedValue('ing-456') });
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: { type: 'github', url: 'https://github.com/o/r', token: 'ghp_abc' },
          }),
        });
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.ingestionId).toBe('ing-456');
        expect(svc.startIngestion).toHaveBeenCalledWith({
          source: { type: 'github', url: 'https://github.com/o/r', token: 'ghp_abc' },
        });
      } finally {
        server.close();
      }
    });

    it('resolves token from TokenService when not provided in request', async () => {
      const svc = createMockIngestionService({ startIngestion: vi.fn().mockResolvedValue('ing-789') });
      const tokenSvc = createMockTokenService({ getToken: vi.fn().mockResolvedValue('stored-token') });
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: { type: 'azure_devops', url: 'https://dev.azure.com/org/proj/_git/repo' },
          }),
        });
        expect(res.status).toBe(202);
        expect(svc.startIngestion).toHaveBeenCalledWith({
          source: {
            type: 'azure_devops',
            url: 'https://dev.azure.com/org/proj/_git/repo',
            token: 'stored-token',
          },
        });
      } finally {
        server.close();
      }
    });

    it('returns 500 when ingestion service throws', async () => {
      const svc = createMockIngestionService({
        startIngestion: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      });
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: { type: 'local', path: '/tmp/repo' } }),
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.message).toContain('DB connection failed');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/ingestions/:id', () => {
    it('returns 404 when ingestion not found', async () => {
      const svc = createMockIngestionService({ getIngestionStatus: vi.fn().mockResolvedValue(null) });
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions/nonexistent-id`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
        expect(body.message).toContain('nonexistent-id');
      } finally {
        server.close();
      }
    });

    it('returns 200 with ingestion record when found', async () => {
      const record: IngestionRecord = {
        id: 'ing-001',
        repositoryId: 'repo-001',
        status: 'completed',
        startedAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: new Date('2024-01-01T00:01:00Z'),
      };
      const svc = createMockIngestionService({
        getIngestionStatus: vi.fn().mockResolvedValue(record),
      });
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions/ing-001`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe('ing-001');
        expect(body.repositoryId).toBe('repo-001');
        expect(body.status).toBe('completed');
      } finally {
        server.close();
      }
    });

    it('returns 500 when service throws', async () => {
      const svc = createMockIngestionService({
        getIngestionStatus: vi.fn().mockRejectedValue(new Error('query failed')),
      });
      const tokenSvc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc, tokenSvc);

      try {
        const res = await fetch(`${baseUrl}/api/ingestions/ing-001`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });
});
