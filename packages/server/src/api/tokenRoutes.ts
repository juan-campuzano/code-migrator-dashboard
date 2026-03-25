import { Router, Request, Response } from 'express';
import type { TokenService } from '../services/TokenService';
import type { ApiError } from '../models/types';

const VALID_PROVIDERS = ['github', 'azure_devops'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (VALID_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Create an Express Router for token settings endpoints.
 *
 * PUT  /api/settings/tokens — store/update an access token
 * GET  /api/settings/tokens — list configured providers (no secrets)
 */
export function createTokenRouter(tokenService: TokenService): Router {
  const router = Router();

  router.put('/', async (req: Request, res: Response) => {
    try {
      const { provider, token } = req.body ?? {};

      if (!isValidProvider(provider)) {
        const error: ApiError = {
          code: 'VALIDATION_ERROR',
          message: `Invalid provider "${provider}". Must be one of: ${VALID_PROVIDERS.join(', ')}.`,
        };
        res.status(400).json(error);
        return;
      }

      if (!token || typeof token !== 'string') {
        const error: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'A non-empty "token" string is required.',
        };
        res.status(400).json(error);
        return;
      }

      await tokenService.storeToken(provider, token);
      res.status(200).json({ message: 'Token stored successfully', provider });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const providers = await tokenService.getConfiguredProviders();
      res.status(200).json(providers);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  return router;
}
