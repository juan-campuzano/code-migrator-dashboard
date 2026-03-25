import type { ApiError } from '../models/types';

/**
 * Shape shared by GitHubApiError and AzureDevOpsApiError.
 */
interface AdapterError extends Error {
  code: string;
  retryAfter?: number;
}

function isAdapterError(error: unknown): error is AdapterError {
  return (
    error instanceof Error &&
    typeof (error as AdapterError).code === 'string'
  );
}

const PROVIDER_MAP: Record<string, string> = {
  GitHubApiError: 'github',
  AzureDevOpsApiError: 'azure_devops',
};

const STATUS_MAP: Record<string, number> = {
  AUTH_ERROR: 401,
  RATE_LIMIT_EXCEEDED: 429,
  NOT_FOUND: 404,
};

/**
 * Map an ingestion error (typically from a source adapter) to an HTTP status
 * and structured ApiError body.
 */
export function mapIngestionError(error: unknown): { status: number; body: ApiError } {
  if (!isAdapterError(error)) {
    return {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const status = STATUS_MAP[error.code] ?? 500;
  const provider = PROVIDER_MAP[error.name];

  if (error.code === 'AUTH_ERROR' || error.code === 'NOT_FOUND') {
    return {
      status,
      body: {
        code: error.code,
        message: error.message,
        ...(provider ? { provider } : {}),
      },
    };
  }

  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return {
      status: 429,
      body: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message,
        ...(error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {}),
      },
    };
  }

  // All other adapter error codes → 500
  return {
    status: 500,
    body: {
      code: 'INTERNAL_ERROR',
      message: error.message,
    },
  };
}
