export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function isValidHexKey(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

function isValidBase64Key(value: string): boolean {
  try {
    const buf = Buffer.from(value, 'base64');
    // Ensure it actually decoded as valid base64 (not just passthrough)
    if (buf.toString('base64') !== value) {
      return false;
    }
    return buf.length === 32;
  } catch {
    return false;
  }
}

export function validateEnv(env: Record<string, string | undefined>): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate database configuration: either DATABASE_URL or PG_HOST + PG_DATABASE + PG_USER
  const hasDatabaseUrl = !!env.DATABASE_URL;
  const hasPgHost = !!env.PG_HOST;
  const hasPgDatabase = !!env.PG_DATABASE;
  const hasPgUser = !!env.PG_USER;
  const hasPgCombo = hasPgHost && hasPgDatabase && hasPgUser;

  if (!hasDatabaseUrl && !hasPgCombo) {
    const missing: string[] = [];
    if (!hasPgHost) missing.push('PG_HOST');
    if (!hasPgDatabase) missing.push('PG_DATABASE');
    if (!hasPgUser) missing.push('PG_USER');
    errors.push(
      `Missing database configuration: either DATABASE_URL or ${missing.join(', ')} must be set`
    );
  }

  // Validate TOKEN_ENCRYPTION_KEY if provided
  const tokenKey = env.TOKEN_ENCRYPTION_KEY;
  if (tokenKey !== undefined && tokenKey !== '') {
    if (!isValidHexKey(tokenKey) && !isValidBase64Key(tokenKey)) {
      errors.push(
        'TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters or valid base64 encoding)'
      );
    }
  } else {
    warnings.push('TOKEN_ENCRYPTION_KEY is not set: token management endpoints are disabled');
  }

  // Validate AI_PROVIDER_TYPE if provided
  const SUPPORTED_AI_PROVIDERS = ['copilot', 'claude', 'gemini'];
  const aiProviderType = env.AI_PROVIDER_TYPE;
  if (aiProviderType !== undefined && aiProviderType !== '') {
    if (!SUPPORTED_AI_PROVIDERS.includes(aiProviderType)) {
      errors.push(
        `AI_PROVIDER_TYPE must be one of: ${SUPPORTED_AI_PROVIDERS.join(', ')} (got "${aiProviderType}")`
      );
    }
  }

  // Validate MIGRATION_POLL_INTERVAL_MS if provided
  const pollInterval = env.MIGRATION_POLL_INTERVAL_MS;
  if (pollInterval !== undefined && pollInterval !== '') {
    const parsed = Number(pollInterval);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      errors.push(
        'MIGRATION_POLL_INTERVAL_MS must be a positive number'
      );
    }
  }

  // Warn if AI_PROVIDER_API_KEY is not set (migration agent will be disabled)
  if (!env.AI_PROVIDER_API_KEY) {
    warnings.push('AI_PROVIDER_API_KEY is not set: migration agent will be disabled');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
