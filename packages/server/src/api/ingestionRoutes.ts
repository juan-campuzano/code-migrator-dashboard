import { Router, Request, Response } from 'express';
import type { IngestionService } from '../services/IngestionService';
import type { TokenService } from '../services/TokenService';
import type { ApiError, RepositorySource } from '../models/types';
import { mapIngestionError } from './mapIngestionError';

const VALID_SOURCE_TYPES = ['local', 'github', 'azure_devops'] as const;

function isValidSourceType(type: unknown): type is RepositorySource['type'] {
  return typeof type === 'string' && (VALID_SOURCE_TYPES as readonly string[]).includes(type);
}

function buildValidationError(message: string): ApiError {
  return { code: 'VALIDATION_ERROR', message };
}

/**
 * Create an Express Router for ingestion endpoints.
 *
 * POST /api/ingestions  — trigger a new ingestion, returns 202
 * GET  /api/ingestions/:id — get ingestion status
 */
export function createIngestionRouter(
  ingestionService: IngestionService,
  tokenService: TokenService,
): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { source } = req.body ?? {};

      if (!source || typeof source !== 'object') {
        res.status(400).json(buildValidationError('Request body must include a "source" object.'));
        return;
      }

      if (!isValidSourceType(source.type)) {
        res.status(400).json(
          buildValidationError(
            `Invalid source type "${source.type}". Must be one of: ${VALID_SOURCE_TYPES.join(', ')}.`,
          ),
        );
        return;
      }

      if (source.type === 'local') {
        if (!source.path || typeof source.path !== 'string') {
          res.status(400).json(
            buildValidationError('Local source requires a non-empty "path" string.'),
          );
          return;
        }
      }

      if (source.type === 'github' || source.type === 'azure_devops') {
        if (!source.url || typeof source.url !== 'string') {
          res.status(400).json(
            buildValidationError(`${source.type} source requires a non-empty "url" string.`),
          );
          return;
        }
      }

      // Build RepositorySource, resolving token from TokenService if not provided
      let repoSource: RepositorySource;

      if (source.type === 'local') {
        repoSource = { type: 'local', path: source.path };
      } else {
        let token: string = source.token ?? '';
        if (!token) {
          const storedToken = tokenService ? await tokenService.getToken(source.type) : null;
          if (!storedToken) {
            const apiError: ApiError = {
              code: 'AUTH_MISSING_TOKEN',
              message: `No access token configured for ${source.type}. Please configure authentication.`,
              provider: source.type,
            };
            res.status(400).json(apiError);
            return;
          }
          token = storedToken;
        }
        repoSource = { type: source.type, url: source.url, token };
      }

      // Start ingestion — IngestionService persists status to DB on success/failure
      const ingestionId = await ingestionService.startIngestion({ source: repoSource });
      res.status(202).json({ ingestionId });
    } catch (error: unknown) {
      const { status, body } = mapIngestionError(error);
      res.status(status).json(body);
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const record = await ingestionService.getIngestionStatus(id);

      if (!record) {
        const apiError: ApiError = {
          code: 'NOT_FOUND',
          message: `Ingestion with ID "${id}" not found.`,
        };
        res.status(404).json(apiError);
        return;
      }

      res.status(200).json(record);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  return router;
}
