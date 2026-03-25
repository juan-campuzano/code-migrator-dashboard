import { Router, Request, Response } from 'express';
import type { RepositoryDb } from '../db/RepositoryDb';
import type { ApiError } from '../models/types';

/**
 * Create an Express Router for migration placeholder endpoints.
 *
 * POST /api/migrations     — queue a migration (placeholder, no actual work)
 * GET  /api/migrations/:id — get migration status
 */
export function createMigrationRouter(db: RepositoryDb): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { repositoryId, migrationType, parameters } = req.body ?? {};

      if (!repositoryId || typeof repositoryId !== 'string') {
        const error: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'A non-empty "repositoryId" string is required.',
        };
        res.status(400).json(error);
        return;
      }

      if (!migrationType || typeof migrationType !== 'string') {
        const error: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'A non-empty "migrationType" string is required.',
        };
        res.status(400).json(error);
        return;
      }

      // Validate repository exists
      const repo = await db.getRepository(repositoryId);
      if (!repo) {
        const error: ApiError = {
          code: 'NOT_FOUND',
          message: `Repository with ID "${repositoryId}" not found.`,
        };
        res.status(404).json(error);
        return;
      }

      // Validate repository has a completed ingestion
      const ingested = await db.hasCompletedIngestion(repositoryId);
      if (!ingested) {
        const error: ApiError = {
          code: 'PRECONDITION_FAILED',
          message: `Repository "${repositoryId}" has not been successfully ingested yet.`,
        };
        res.status(422).json(error);
        return;
      }

      const migration = await db.createMigration(repositoryId, migrationType, parameters);

      res.status(202).json({
        migrationId: migration.migrationId,
        status: migration.status,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const migration = await db.getMigrationById(id);

      if (!migration) {
        const error: ApiError = {
          code: 'NOT_FOUND',
          message: `Migration with ID "${id}" not found.`,
        };
        res.status(404).json(error);
        return;
      }

      res.status(200).json(migration);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  return router;
}
