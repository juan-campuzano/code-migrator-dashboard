import { Router, Request, Response } from 'express';
import type { RepositoryDb } from '../db/RepositoryDb';
import type { ApiError, RepositoryDependency } from '../models/types';

interface DependencyGroup {
  count: number;
  dependencies: Omit<RepositoryDependency, 'ecosystem'>[];
}

/**
 * Create an Express Router for repository metadata endpoints.
 *
 * GET /api/repositories/:id/metadata     — full metadata
 * GET /api/repositories/:id/languages    — language breakdown
 * GET /api/repositories/:id/frameworks   — detected frameworks
 * GET /api/repositories/:id/dependencies — dependencies grouped by ecosystem
 */
export function createRepositoryRouter(db: RepositoryDb): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const repositories = await db.listRepositories();
      res.status(200).json(repositories);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/:id/metadata', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const metadata = await db.getRepositoryMetadata(id);

      if (!metadata) {
        const apiError: ApiError = {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found or has no ingestion data.`,
        };
        res.status(404).json(apiError);
        return;
      }

      res.status(200).json(metadata);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/:id/languages', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const repo = await db.getRepository(id);

      if (!repo) {
        const apiError: ApiError = {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found.`,
        };
        res.status(404).json(apiError);
        return;
      }

      const languages = await db.getRepositoryLanguages(id);
      res.status(200).json(languages);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/:id/frameworks', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const repo = await db.getRepository(id);

      if (!repo) {
        const apiError: ApiError = {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found.`,
        };
        res.status(404).json(apiError);
        return;
      }

      const frameworks = await db.getRepositoryFrameworks(id);
      res.status(200).json(frameworks);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/:id/dependencies', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const repo = await db.getRepository(id);

      if (!repo) {
        const apiError: ApiError = {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found.`,
        };
        res.status(404).json(apiError);
        return;
      }

      const dependencies = await db.getRepositoryDependencies(id);
      const grouped: Record<string, DependencyGroup> = {};

      for (const dep of dependencies) {
        if (!grouped[dep.ecosystem]) {
          grouped[dep.ecosystem] = { count: 0, dependencies: [] };
        }
        grouped[dep.ecosystem].count += 1;
        grouped[dep.ecosystem].dependencies.push({
          name: dep.name,
          versionConstraint: dep.versionConstraint,
          dependencyType: dep.dependencyType,
        });
      }

      res.status(200).json(grouped);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  return router;
}
