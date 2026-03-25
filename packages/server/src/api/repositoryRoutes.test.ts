import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { createRepositoryRouter } from './repositoryRoutes';
import type { RepositoryDb } from '../db/RepositoryDb';
import type {
  Repository,
  RepositoryMetadata,
  RepositoryLanguage,
  RepositoryFramework,
  RepositoryDependency,
  IngestionRecord,
} from '../models/types';

// --- Fixtures ---

const REPO: Repository = {
  id: 'repo-001',
  name: 'test-repo',
  sourceType: 'local',
  sourceIdentifier: '/tmp/test-repo',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const INGESTION: IngestionRecord = {
  id: 'ing-001',
  repositoryId: 'repo-001',
  status: 'completed',
  startedAt: new Date('2024-01-01T00:00:00Z'),
  completedAt: new Date('2024-01-01T00:01:00Z'),
};

const LANGUAGES: RepositoryLanguage[] = [
  { language: 'TypeScript', fileCount: 10, proportion: 0.7 },
  { language: 'JavaScript', fileCount: 3, proportion: 0.2 },
  { language: 'JSON', fileCount: 2, proportion: 0.1 },
];

const FRAMEWORKS: RepositoryFramework[] = [
  { name: 'express', version: '4.18.2' },
  { name: 'react', version: '18.2.0' },
];

const DEPENDENCIES: RepositoryDependency[] = [
  { ecosystem: 'npm', name: 'express', versionConstraint: '^4.18.2', dependencyType: 'production' },
  { ecosystem: 'npm', name: 'vitest', versionConstraint: '^1.0.0', dependencyType: 'development' },
  { ecosystem: 'pip', name: 'flask', versionConstraint: '>=2.0', dependencyType: 'production' },
];

const METADATA: RepositoryMetadata = {
  repository: REPO,
  latestIngestion: INGESTION,
  languages: LANGUAGES,
  frameworks: FRAMEWORKS,
  dependencies: DEPENDENCIES,
};

// --- Helpers ---

function createMockDb(overrides: Partial<RepositoryDb> = {}): RepositoryDb {
  return {
    getRepository: vi.fn().mockResolvedValue(REPO),
    getRepositoryMetadata: vi.fn().mockResolvedValue(METADATA),
    getRepositoryLanguages: vi.fn().mockResolvedValue(LANGUAGES),
    getRepositoryFrameworks: vi.fn().mockResolvedValue(FRAMEWORKS),
    getRepositoryDependencies: vi.fn().mockResolvedValue(DEPENDENCIES),
    ...overrides,
  } as unknown as RepositoryDb;
}

function startApp(db: RepositoryDb) {
  const app = express();
  app.use(express.json());
  app.use('/api/repositories', createRepositoryRouter(db));

  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// --- Tests ---

describe('repositoryRoutes', () => {
  describe('GET /api/repositories/:id/metadata', () => {
    it('returns 200 with full metadata when found', async () => {
      const db = createMockDb();
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/metadata`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.repository.id).toBe('repo-001');
        expect(body.latestIngestion.status).toBe('completed');
        expect(body.languages).toHaveLength(3);
        expect(body.frameworks).toHaveLength(2);
        expect(body.dependencies).toHaveLength(3);
      } finally {
        server.close();
      }
    });

    it('returns 404 when repository not found', async () => {
      const db = createMockDb({ getRepositoryMetadata: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/nonexistent/metadata`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
        expect(body.message).toContain('nonexistent');
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getRepositoryMetadata: vi.fn().mockRejectedValue(new Error('db error')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/metadata`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/repositories/:id/languages', () => {
    it('returns 200 with language breakdown', async () => {
      const db = createMockDb();
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/languages`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(3);
        expect(body[0].language).toBe('TypeScript');
        expect(body[0].proportion).toBe(0.7);
      } finally {
        server.close();
      }
    });

    it('returns 404 when repository not found', async () => {
      const db = createMockDb({ getRepository: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/nonexistent/languages`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockRejectedValue(new Error('db error')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/languages`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/repositories/:id/frameworks', () => {
    it('returns 200 with detected frameworks', async () => {
      const db = createMockDb();
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/frameworks`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(2);
        expect(body[0].name).toBe('express');
        expect(body[0].version).toBe('4.18.2');
      } finally {
        server.close();
      }
    });

    it('returns 404 when repository not found', async () => {
      const db = createMockDb({ getRepository: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/nonexistent/frameworks`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockRejectedValue(new Error('db error')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/frameworks`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });

  describe('GET /api/repositories/:id/dependencies', () => {
    it('returns 200 with dependencies grouped by ecosystem', async () => {
      const db = createMockDb();
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/dependencies`);
        expect(res.status).toBe(200);
        const body = await res.json();

        // npm group
        expect(body.npm).toBeDefined();
        expect(body.npm.count).toBe(2);
        expect(body.npm.dependencies).toHaveLength(2);
        expect(body.npm.dependencies[0].name).toBe('express');
        expect(body.npm.dependencies[0].versionConstraint).toBe('^4.18.2');
        expect(body.npm.dependencies[0].dependencyType).toBe('production');

        // pip group
        expect(body.pip).toBeDefined();
        expect(body.pip.count).toBe(1);
        expect(body.pip.dependencies).toHaveLength(1);
        expect(body.pip.dependencies[0].name).toBe('flask');

        // ecosystem key should not appear inside individual dependencies
        for (const dep of body.npm.dependencies) {
          expect(dep.ecosystem).toBeUndefined();
        }
      } finally {
        server.close();
      }
    });

    it('returns 200 with empty object when no dependencies', async () => {
      const db = createMockDb({ getRepositoryDependencies: vi.fn().mockResolvedValue([]) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/dependencies`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({});
      } finally {
        server.close();
      }
    });

    it('returns 404 when repository not found', async () => {
      const db = createMockDb({ getRepository: vi.fn().mockResolvedValue(null) });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/nonexistent/dependencies`);
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('NOT_FOUND');
      } finally {
        server.close();
      }
    });

    it('returns 500 when db throws', async () => {
      const db = createMockDb({
        getRepository: vi.fn().mockRejectedValue(new Error('db error')),
      });
      const { server, baseUrl } = await startApp(db);

      try {
        const res = await fetch(`${baseUrl}/api/repositories/repo-001/dependencies`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe('INTERNAL_ERROR');
      } finally {
        server.close();
      }
    });
  });
});
