import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { createMigrationRouter } from './migrationRoutes';
import type { RepositoryDb } from '../db/RepositoryDb';
import type { MigrationStatus } from '../models/types';

// --- Helpers ---

function createMockDb(overrides: Partial<RepositoryDb> = {}) {
  return {
    getRepository: vi.fn().mockResolvedValue(null),
    hasCompletedIngestion: vi.fn().mockResolvedValue(false),
    createMigration: vi.fn().mockResolvedValue(null),
    getMigrationById: vi.fn().mockResolvedValue(null),
    listMigrations: vi.fn().mockResolvedValue([]),
    cancelMigration: vi.fn().mockResolvedValue(false),
    ...overrides,
  } as unknown as RepositoryDb;
}

function startApp(db: RepositoryDb) {
  const app = express();
  app.use(express.json());
  app.use('/api/migrations', createMigrationRouter(db));

  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// --- Tests ---

describe('migrationRoutes', () => {
  describe('POST /api/migrations', () => {
    it('returns 400 when repositoryId is missing', async () => {
      const db = createMockDb();
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ migrationType: 'framework_upgrade' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('repositoryId');
      } finally {
        server.close();
      }
    });

    it('returns 400 when migrationType is missing', async () => {
      const db = createMockDb();
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: 'repo-001' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('migrationType');
      } finally {
        server.close();
      }
    });

    it('returns 404 when repository does not exist', async () => {
      const db = createMockDb({ getRepository: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: 'nonexistent', migrationType: 'framework_upgrade' }),
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
        expect(body.message).toContain('nonexistent');
      } finally {
        server.close();
      }
    });

    it('returns 422 when repository has no completed ingestion', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockResolvedValue({ id: 'repo-001', name: 'test', sourceType: 'github' }),
        hasCompletedIngestion: vi.fn().mockResolvedValue(false),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: 'repo-001', migrationType: 'framework_upgrade' }),
        });
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.code).toBe('PRECONDITION_FAILED');
        expect(body.message).toContain('ingested');
      } finally {
        server.close();
      }
    });

    it('returns 202 with migrationId and status queued for valid request', async () => {
      const mockMigration: MigrationStatus = {
        migrationId: 'mig-001',
        repositoryId: 'repo-001',
        migrationType: 'framework_upgrade',
        status: 'queued',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      const db = createMockDb({
        getRepository: vi.fn().mockResolvedValue({ id: 'repo-001', name: 'test', sourceType: 'github' }),
        hasCompletedIngestion: vi.fn().mockResolvedValue(true),
        createMigration: vi.fn().mockResolvedValue(mockMigration),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repositoryId: 'repo-001',
            migrationType: 'framework_upgrade',
            parameters: { targetVersion: '2.0' },
          }),
        });
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.migrationId).toBe('mig-001');
        expect(body.status).toBe('queued');
        expect(db.createMigration).toHaveBeenCalledWith(
          'repo-001',
          'framework_upgrade',
          { targetVersion: '2.0' },
        );
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockRejectedValue(new Error('connection lost')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: 'repo-001', migrationType: 'upgrade' }),
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.message).toContain('connection lost');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/migrations/:id', () => {
    it('returns 404 when migration not found', async () => {
      const db = createMockDb({ getMigrationById: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/nonexistent-id`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
        expect(body.message).toContain('nonexistent-id');
      } finally {
        server.close();
      }
    });

    it('returns 200 with migration status when found', async () => {
      const migration: MigrationStatus = {
        migrationId: 'mig-001',
        repositoryId: 'repo-001',
        migrationType: 'dependency_migration',
        status: 'queued',
        parameters: { from: 'lodash', to: 'ramda' },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      const db = createMockDb({ getMigrationById: vi.fn().mockResolvedValue(migration) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/mig-001`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.migrationId).toBe('mig-001');
        expect(body.repositoryId).toBe('repo-001');
        expect(body.migrationType).toBe('dependency_migration');
        expect(body.status).toBe('queued');
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getMigrationById: vi.fn().mockRejectedValue(new Error('query failed')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/mig-001`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });

  describe('POST /api/migrations — GitHub-only validation', () => {
    it('returns 422 when repository is not a GitHub repository', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockResolvedValue({ id: 'repo-001', name: 'test', sourceType: 'local' }),
        hasCompletedIngestion: vi.fn().mockResolvedValue(true),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: 'repo-001', migrationType: 'ai-upgrade' }),
        });
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('GitHub');
      } finally {
        server.close();
      }
    });

    it('returns 422 for azure_devops repository', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockResolvedValue({ id: 'repo-002', name: 'azure-repo', sourceType: 'azure_devops' }),
        hasCompletedIngestion: vi.fn().mockResolvedValue(true),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: 'repo-002', migrationType: 'ai-upgrade' }),
        });
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.message).toContain('GitHub');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/migrations', () => {
    it('returns 200 with empty array when no migrations exist', async () => {
      const db = createMockDb({
        listMigrations: vi.fn().mockResolvedValue([]),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual([]);
        expect(db.listMigrations).toHaveBeenCalledWith({
          repositoryId: undefined,
          status: undefined,
        });
      } finally {
        server.close();
      }
    });

    it('returns migrations filtered by repositoryId', async () => {
      const migrations: MigrationStatus[] = [
        {
          migrationId: 'mig-001',
          repositoryId: 'repo-001',
          migrationType: 'ai-upgrade',
          status: 'queued',
          createdAt: new Date('2024-01-02T00:00:00Z'),
          updatedAt: new Date('2024-01-02T00:00:00Z'),
        },
      ];
      const db = createMockDb({
        listMigrations: vi.fn().mockResolvedValue(migrations),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations?repositoryId=repo-001`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(1);
        expect(body[0].migrationId).toBe('mig-001');
        expect(db.listMigrations).toHaveBeenCalledWith({
          repositoryId: 'repo-001',
          status: undefined,
        });
      } finally {
        server.close();
      }
    });

    it('returns migrations filtered by status', async () => {
      const db = createMockDb({
        listMigrations: vi.fn().mockResolvedValue([]),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations?status=running`);
        expect(res.status).toBe(200);
        expect(db.listMigrations).toHaveBeenCalledWith({
          repositoryId: undefined,
          status: 'running',
        });
      } finally {
        server.close();
      }
    });

    it('returns migrations filtered by both repositoryId and status', async () => {
      const db = createMockDb({
        listMigrations: vi.fn().mockResolvedValue([]),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations?repositoryId=repo-001&status=queued`);
        expect(res.status).toBe(200);
        expect(db.listMigrations).toHaveBeenCalledWith({
          repositoryId: 'repo-001',
          status: 'queued',
        });
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        listMigrations: vi.fn().mockRejectedValue(new Error('db error')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });

  describe('POST /api/migrations/:id/cancel', () => {
    it('returns 404 when migration does not exist', async () => {
      const db = createMockDb({
        getMigrationById: vi.fn().mockResolvedValue(null),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/nonexistent/cancel`, {
          method: 'POST',
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
        expect(body.message).toContain('nonexistent');
      } finally {
        server.close();
      }
    });

    it('returns 409 when migration is not in queued status', async () => {
      const migration: MigrationStatus = {
        migrationId: 'mig-001',
        repositoryId: 'repo-001',
        migrationType: 'ai-upgrade',
        status: 'running',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      const db = createMockDb({
        getMigrationById: vi.fn().mockResolvedValue(migration),
        cancelMigration: vi.fn().mockResolvedValue(false),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/mig-001/cancel`, {
          method: 'POST',
        });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.code).toBe('CONFLICT');
      } finally {
        server.close();
      }
    });

    it('returns 200 when migration is successfully cancelled', async () => {
      const migration: MigrationStatus = {
        migrationId: 'mig-001',
        repositoryId: 'repo-001',
        migrationType: 'ai-upgrade',
        status: 'queued',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      const db = createMockDb({
        getMigrationById: vi.fn().mockResolvedValue(migration),
        cancelMigration: vi.fn().mockResolvedValue(true),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/mig-001/cancel`, {
          method: 'POST',
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.migrationId).toBe('mig-001');
        expect(body.status).toBe('failed');
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getMigrationById: vi.fn().mockRejectedValue(new Error('cancel error')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/migrations/mig-001/cancel`, {
          method: 'POST',
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });
});
