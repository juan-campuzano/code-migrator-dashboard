import { Router, Request, Response } from 'express';
import type { RepositoryDb } from '../db/RepositoryDb';
import type { FreshnessService } from '../services/FreshnessService';
import type { ApiError } from '../models/types';

/**
 * Create an Express Router for freshness scoring endpoints.
 *
 * GET  /:id/freshness          — return freshness scores for a repository
 * POST /:id/freshness/refresh  — trigger re-computation of freshness scores
 */
export function createFreshnessRouter(
  db: RepositoryDb,
  freshnessService: FreshnessService,
): Router {
  const router = Router();

  router.get('/:id/freshness', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ecosystem = req.query.ecosystem as string | undefined;

      const result = await db.getFreshnessScores(id);

      if (!result) {
        const apiError: ApiError = {
          code: 'NOT_FOUND',
          message: `No freshness scores found for repository "${id}".`,
        };
        res.status(404).json(apiError);
        return;
      }

      if (ecosystem) {
        result.dependencies = result.dependencies.filter(
          (dep) => dep.ecosystem === ecosystem,
        );
      }

      res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.post('/:id/freshness/refresh', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (freshnessService.isScoring(id)) {
        const apiError: ApiError = {
          code: 'CONFLICT',
          message: `Freshness scoring is already in progress for repository "${id}".`,
        };
        res.status(409).json(apiError);
        return;
      }

      const hasIngestion = await db.hasCompletedIngestion(id);
      if (!hasIngestion) {
        const apiError: ApiError = {
          code: 'BAD_REQUEST',
          message: `Repository "${id}" has no completed ingestion. Run an ingestion first.`,
        };
        res.status(400).json(apiError);
        return;
      }

      // Fire and forget — respond immediately with 202
      freshnessService.computeScores(id).catch(() => {
        // Errors are handled internally by FreshnessService
      });

      res.status(202).json({ message: 'Freshness scoring started.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  return router;
}
