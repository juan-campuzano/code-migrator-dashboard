import { Pool } from 'pg';

/**
 * Validates database connectivity by executing a lightweight test query.
 * On success, logs a confirmation message.
 * On failure, logs a descriptive error including configured host/port and re-throws.
 */
export async function validateDbConnection(pool: Pool): Promise<void> {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection validated successfully.');
  } catch (error) {
    const host = (pool as any).options?.host ?? 'unknown';
    const port = (pool as any).options?.port ?? 'unknown';
    console.error(
      `Failed to connect to database at ${host}:${port} — ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
