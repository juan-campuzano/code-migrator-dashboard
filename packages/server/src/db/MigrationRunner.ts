import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const CREATE_SCHEMA_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export class MigrationRunner {
  /**
   * Execute all pending migrations. Creates schema_migrations table if needed.
   * Returns the count of newly applied migrations.
   * Throws on failure, preventing server startup.
   */
  async run(pool: Pool): Promise<number> {
    // Ensure the tracking table exists
    await pool.query(CREATE_SCHEMA_MIGRATIONS_TABLE);

    // Read all *.sql files from the migrations directory, sorted by filename
    const allFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Fetch already-applied migrations
    const applied = await pool.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));

    // Determine pending migrations
    const pending = allFiles.filter((f) => !appliedSet.has(f));

    // Execute each pending migration inside a transaction
    for (const filename of pending) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Migration failed: ${filename}`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(`Migrations complete: ${pending.length} newly applied.`);
    return pending.length;
  }
}
