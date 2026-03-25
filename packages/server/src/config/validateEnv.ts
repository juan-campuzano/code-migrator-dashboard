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

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
