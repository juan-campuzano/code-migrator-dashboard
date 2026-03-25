import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { createTokenRouter } from './tokenRoutes';
import type { TokenService } from '../services/TokenService';

// --- Helpers ---

function createMockTokenService(overrides: Partial<TokenService> = {}) {
  return {
    storeToken: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue(null),
    getConfiguredProviders: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as TokenService;
}

function startApp(tokenService: TokenService) {
  const app = express();
  app.use(express.json());
  app.use('/api/settings/tokens', createTokenRouter(tokenService));

  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// --- Tests ---

describe('tokenRoutes', () => {
  describe('PUT /api/settings/tokens', () => {
    it('returns 400 when provider is missing', async () => {
      const svc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'ghp_abc' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('provider');
      } finally {
        server.close();
      }
    });

    it('returns 400 when provider is invalid', async () => {
      const svc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'bitbucket', token: 'abc' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('bitbucket');
      } finally {
        server.close();
      }
    });

    it('returns 400 when token is missing', async () => {
      const svc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('token');
      } finally {
        server.close();
      }
    });

    it('returns 400 when token is empty string', async () => {
      const svc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github', token: '' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
      } finally {
        server.close();
      }
    });

    it('returns 200 and stores github token', async () => {
      const svc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github', token: 'ghp_abc123' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe('Token stored successfully');
        expect(body.provider).toBe('github');
        expect(svc.storeToken).toHaveBeenCalledWith('github', 'ghp_abc123');
      } finally {
        server.close();
      }
    });

    it('returns 200 and stores azure_devops token', async () => {
      const svc = createMockTokenService();
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'azure_devops', token: 'pat-xyz' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe('Token stored successfully');
        expect(body.provider).toBe('azure_devops');
        expect(svc.storeToken).toHaveBeenCalledWith('azure_devops', 'pat-xyz');
      } finally {
        server.close();
      }
    });

    it('returns 500 when storeToken throws', async () => {
      const svc = createMockTokenService({
        storeToken: vi.fn().mockRejectedValue(new Error('DB write failed')),
      });
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github', token: 'ghp_abc' }),
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.message).toContain('DB write failed');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/settings/tokens', () => {
    it('returns 200 with empty array when no tokens configured', async () => {
      const svc = createMockTokenService({
        getConfiguredProviders: vi.fn().mockResolvedValue([]),
      });
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual([]);
      } finally {
        server.close();
      }
    });

    it('returns 200 with configured providers', async () => {
      const providers = [
        { provider: 'github', configuredAt: new Date('2024-06-01T12:00:00Z') },
        { provider: 'azure_devops', configuredAt: new Date('2024-06-02T08:00:00Z') },
      ];
      const svc = createMockTokenService({
        getConfiguredProviders: vi.fn().mockResolvedValue(providers),
      });
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(2);
        expect(body[0].provider).toBe('github');
        expect(body[1].provider).toBe('azure_devops');
      } finally {
        server.close();
      }
    });

    it('returns 500 when getConfiguredProviders throws', async () => {
      const svc = createMockTokenService({
        getConfiguredProviders: vi.fn().mockRejectedValue(new Error('DB read failed')),
      });
      const { server, baseUrl } = await startApp(svc);

      try {
        const res = await fetch(`${baseUrl}/api/settings/tokens`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.message).toContain('DB read failed');
      } finally {
        server.close();
      }
    });
  });
});
