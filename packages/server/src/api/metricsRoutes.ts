import { Router, Request, Response } from 'express';
import type { RepositoryDb } from '../db/RepositoryDb';
import type { ApiError } from '../models/types';
import { MetricsService } from '../services/MetricsService';

/**
 * Create an Express Router for metrics summary endpoints.
 *
 * GET /summary — return aggregated metrics across all repositories
 */
export function createMetricsRouter(db: RepositoryDb): Router {
  const router = Router();
  const metricsService = new MetricsService(db);

  router.get('/summary', async (_req: Request, res: Response) => {
    try {
      const summary = await metricsService.computeSummary();
      res.status(200).json(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  return router;
}
