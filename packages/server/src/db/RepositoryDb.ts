import { Pool } from 'pg';
import {
  Repository,
  IngestionRecord,
  RepositoryLanguage,
  RepositoryFramework,
  RepositoryDependency,
  RepositoryMetadata,
  FileEntry,
  MigrationStatus,
  FreshnessResult,
  RepositoryGrade,
  DependencyFreshnessScore,
} from '../models/types';

export class RepositoryDb {
  constructor(private pool: Pool) {}

  async upsertRepository(
    name: string,
    sourceType: 'local' | 'github' | 'azure_devops',
    sourceIdentifier: string
  ): Promise<Repository> {
    const result = await this.pool.query(
      `INSERT INTO repositories (name, source_type, source_identifier)
       VALUES ($1, $2, $3)
       ON CONFLICT (source_identifier) DO UPDATE
         SET name = EXCLUDED.name,
             source_type = EXCLUDED.source_type,
             updated_at = NOW()
       RETURNING id, name, source_type, source_identifier, created_at, updated_at`,
      [name, sourceType, sourceIdentifier]
    );
    return this.mapRepository(result.rows[0]);
  }

  async getRepository(id: string): Promise<Repository | null> {
    const result = await this.pool.query(
      `SELECT id, name, source_type, source_identifier, created_at, updated_at
       FROM repositories WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRepository(result.rows[0]);
  }

  async listRepositories(): Promise<Repository[]> {
    const result = await this.pool.query(
      `SELECT id, name, source_type, source_identifier, created_at, updated_at
       FROM repositories`
    );
    return result.rows.map((row: Record<string, unknown>) => this.mapRepository(row));
  }


  async createIngestion(repositoryId: string): Promise<IngestionRecord> {
    const result = await this.pool.query(
      `INSERT INTO ingestions (repository_id, status, started_at)
       VALUES ($1, 'in_progress', NOW())
       RETURNING id, repository_id, status, error_details, started_at, completed_at`,
      [repositoryId]
    );
    return this.mapIngestion(result.rows[0]);
  }

  async updateIngestionStatus(
    id: string,
    status: IngestionRecord['status'],
    errorDetails?: string,
    completedAt?: Date
  ): Promise<void> {
    await this.pool.query(
      `UPDATE ingestions
       SET status = $2, error_details = $3, completed_at = $4
       WHERE id = $1`,
      [id, status, errorDetails ?? null, completedAt ?? null]
    );
  }

  async getIngestion(id: string): Promise<IngestionRecord | null> {
    const result = await this.pool.query(
      `SELECT id, repository_id, status, error_details, started_at, completed_at
       FROM ingestions WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapIngestion(result.rows[0]);
  }

  async getLatestIngestion(repositoryId: string): Promise<IngestionRecord | null> {
    const result = await this.pool.query(
      `SELECT id, repository_id, status, error_details, started_at, completed_at
       FROM ingestions
       WHERE repository_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [repositoryId]
    );
    if (result.rows.length === 0) return null;
    return this.mapIngestion(result.rows[0]);
  }

  async upsertLanguages(repositoryId: string, languages: RepositoryLanguage[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM repository_languages WHERE repository_id = $1', [repositoryId]);
      for (const lang of languages) {
        await client.query(
          `INSERT INTO repository_languages (repository_id, language, file_count, proportion)
           VALUES ($1, $2, $3, $4)`,
          [repositoryId, lang.language, lang.fileCount, lang.proportion]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async upsertFrameworks(repositoryId: string, frameworks: RepositoryFramework[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM repository_frameworks WHERE repository_id = $1', [repositoryId]);
      for (const fw of frameworks) {
        await client.query(
          `INSERT INTO repository_frameworks (repository_id, name, version)
           VALUES ($1, $2, $3)`,
          [repositoryId, fw.name, fw.version ?? null]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async upsertDependencies(repositoryId: string, dependencies: RepositoryDependency[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM repository_dependencies WHERE repository_id = $1', [repositoryId]);
      const seen = new Set<string>();
      for (const dep of dependencies) {
        const key = `${dep.ecosystem}::${dep.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await client.query(
          `INSERT INTO repository_dependencies (repository_id, ecosystem, name, version_constraint, dependency_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [repositoryId, dep.ecosystem, dep.name, dep.versionConstraint ?? null, dep.dependencyType]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async upsertFileTree(repositoryId: string, tree: FileEntry[]): Promise<void> {
    await this.pool.query(
      `INSERT INTO repository_file_trees (repository_id, tree, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (repository_id) DO UPDATE
         SET tree = EXCLUDED.tree,
             updated_at = NOW()`,
      [repositoryId, JSON.stringify(tree)]
    );
  }

  async upsertMetadataExtra(repositoryId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO repository_metadata_extra (repository_id, metadata, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (repository_id) DO UPDATE
         SET metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
      [repositoryId, JSON.stringify(metadata)]
    );
  }

  async getRepositoryLanguages(repositoryId: string): Promise<RepositoryLanguage[]> {
    const result = await this.pool.query(
      `SELECT language, file_count, proportion
       FROM repository_languages
       WHERE repository_id = $1
       ORDER BY proportion DESC`,
      [repositoryId]
    );
    return result.rows.map((row) => ({
      language: row.language,
      fileCount: Number(row.file_count),
      proportion: Number(row.proportion),
    }));
  }

  async getRepositoryFrameworks(repositoryId: string): Promise<RepositoryFramework[]> {
    const result = await this.pool.query(
      `SELECT name, version
       FROM repository_frameworks
       WHERE repository_id = $1
       ORDER BY name`,
      [repositoryId]
    );
    return result.rows.map((row) => ({
      name: row.name,
      version: row.version ?? undefined,
    }));
  }

  async getRepositoryDependencies(repositoryId: string): Promise<RepositoryDependency[]> {
    const result = await this.pool.query(
      `SELECT ecosystem, name, version_constraint, dependency_type
       FROM repository_dependencies
       WHERE repository_id = $1
       ORDER BY ecosystem, name`,
      [repositoryId]
    );
    return result.rows.map((row) => ({
      ecosystem: row.ecosystem,
      name: row.name,
      versionConstraint: row.version_constraint ?? undefined,
      dependencyType: row.dependency_type,
    }));
  }

  async getRepositoryMetadata(repositoryId: string): Promise<RepositoryMetadata | null> {
    const repository = await this.getRepository(repositoryId);
    if (!repository) return null;

    const latestIngestion = await this.getLatestIngestion(repositoryId);
    if (!latestIngestion) return null;

    const [languages, frameworks, dependencies] = await Promise.all([
      this.getRepositoryLanguages(repositoryId),
      this.getRepositoryFrameworks(repositoryId),
      this.getRepositoryDependencies(repositoryId),
    ]);

    return {
      repository,
      latestIngestion,
      languages,
      frameworks,
      dependencies,
    };
  }

  private mapRepository(row: Record<string, unknown>): Repository {
    return {
      id: row.id as string,
      name: row.name as string,
      sourceType: row.source_type as Repository['sourceType'],
      sourceIdentifier: row.source_identifier as string,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapIngestion(row: Record<string, unknown>): IngestionRecord {
    return {
      id: row.id as string,
      repositoryId: row.repository_id as string,
      status: row.status as IngestionRecord['status'],
      errorDetails: (row.error_details as string) ?? undefined,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    };
  }


    // ---------------------------------------------------------------------------
    // Migrations (placeholder)
    // ---------------------------------------------------------------------------

    async createMigration(
      repositoryId: string,
      migrationType: string,
      parameters?: Record<string, string>,
    ): Promise<MigrationStatus> {
      const result = await this.pool.query(
        `INSERT INTO migrations (repository_id, migration_type, parameters, status)
         VALUES ($1, $2, $3, 'queued')
         RETURNING id, repository_id, migration_type, parameters, status, result, error_details, created_at, updated_at`,
        [repositoryId, migrationType, JSON.stringify(parameters ?? {})],
      );
      return this.mapMigration(result.rows[0]);
    }

    async getMigrationById(id: string): Promise<MigrationStatus | null> {
      const result = await this.pool.query(
        `SELECT id, repository_id, migration_type, parameters, status, result, error_details, created_at, updated_at
         FROM migrations WHERE id = $1`,
        [id],
      );
      if (result.rows.length === 0) return null;
      return this.mapMigration(result.rows[0]);
    }

    /**
     * Check whether a repository has at least one completed ingestion.
     */
    async hasCompletedIngestion(repositoryId: string): Promise<boolean> {
      const result = await this.pool.query(
        `SELECT 1 FROM ingestions WHERE repository_id = $1 AND status = 'completed' LIMIT 1`,
        [repositoryId],
      );
      return result.rows.length > 0;
    }

    async upsertFreshnessScores(
      repositoryId: string,
      ingestionId: string | null,
      result: FreshnessResult,
    ): Promise<void> {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Delete existing freshness row (cascade deletes dependency scores)
        await client.query(
          'DELETE FROM repository_freshness WHERE repository_id = $1',
          [repositoryId],
        );

        // Insert new repository-level freshness row
        const freshnessResult = await client.query(
          `INSERT INTO repository_freshness (repository_id, ingestion_id, grade, weighted_average, computed_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [repositoryId, ingestionId, result.grade, result.weightedAverage, result.computedAt],
        );
        const freshnessId = freshnessResult.rows[0].id as string;

        // Insert per-dependency scores
        for (const dep of result.dependencies) {
          await client.query(
            `INSERT INTO dependency_freshness_scores
               (freshness_id, dependency_name, ecosystem, resolved_version, latest_version, score, dependency_type, status, error_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              freshnessId,
              dep.dependencyName,
              dep.ecosystem,
              dep.resolvedVersion,
              dep.latestVersion,
              dep.score,
              dep.dependencyType,
              dep.status,
              dep.error ?? null,
            ],
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    async getFreshnessScores(repositoryId: string): Promise<FreshnessResult | null> {
      const freshnessRow = await this.pool.query(
        `SELECT id, repository_id, ingestion_id, grade, weighted_average, computed_at
         FROM repository_freshness
         WHERE repository_id = $1`,
        [repositoryId],
      );

      if (freshnessRow.rows.length === 0) return null;

      const row = freshnessRow.rows[0];
      const freshnessId = row.id as string;

      const depsResult = await this.pool.query(
        `SELECT dependency_name, ecosystem, resolved_version, latest_version, score, dependency_type, status, error_details
         FROM dependency_freshness_scores
         WHERE freshness_id = $1`,
        [freshnessId],
      );

      const dependencies: DependencyFreshnessScore[] = depsResult.rows.map(
        (d: Record<string, unknown>) => ({
          dependencyName: d.dependency_name as string,
          ecosystem: d.ecosystem as string,
          resolvedVersion: (d.resolved_version as string) ?? null,
          latestVersion: (d.latest_version as string) ?? null,
          score: d.score != null ? Number(d.score) : null,
          dependencyType: d.dependency_type as 'production' | 'development',
          status: d.status as DependencyFreshnessScore['status'],
          error: (d.error_details as string) ?? undefined,
        }),
      );

      return {
        repositoryId: row.repository_id as string,
        ingestionId: (row.ingestion_id as string) ?? null,
        grade: row.grade as RepositoryGrade,
        weightedAverage: Number(row.weighted_average),
        computedAt: new Date(row.computed_at as string),
        dependencies,
      };
    }

    /**
     * Atomically claim the oldest queued ai-upgrade job.
     * Uses SELECT FOR UPDATE SKIP LOCKED to avoid contention.
     * Returns null if no queued jobs exist.
     */
    async claimNextJob(): Promise<MigrationStatus | null> {
      const result = await this.pool.query(
        `UPDATE migrations
         SET status = 'running', updated_at = NOW()
         WHERE id = (
           SELECT id FROM migrations
           WHERE status = 'queued'
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, repository_id, migration_type, parameters, status, result, error_details, created_at, updated_at`,
      );
      if (result.rows.length === 0) return null;
      return this.mapMigration(result.rows[0]);
    }

    /**
     * Update a migration's status, result, and/or error_details.
     */
    async updateMigrationStatus(
      id: string,
      status: MigrationStatus['status'],
      result?: string,
      errorDetails?: string,
    ): Promise<void> {
      await this.pool.query(
        `UPDATE migrations
         SET status = $2, result = $3, error_details = $4, updated_at = NOW()
         WHERE id = $1`,
        [id, status, result ?? null, errorDetails ?? null],
      );
    }

    /**
     * List migrations with optional repositoryId and status filters,
     * ordered by created_at DESC.
     */
    async listMigrations(filters?: {
      repositoryId?: string;
      status?: string;
    }): Promise<MigrationStatus[]> {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filters?.repositoryId) {
        conditions.push(`repository_id = $${paramIndex++}`);
        params.push(filters.repositoryId);
      }
      if (filters?.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await this.pool.query(
        `SELECT id, repository_id, migration_type, parameters, status, result, error_details, created_at, updated_at
         FROM migrations
         ${whereClause}
         ORDER BY created_at DESC`,
        params,
      );
      return result.rows.map((row: Record<string, unknown>) => this.mapMigration(row));
    }

    /**
     * Cancel a queued migration. Returns true if cancelled, false otherwise.
     */
    async cancelMigration(id: string): Promise<boolean> {
      const result = await this.pool.query(
        `UPDATE migrations
         SET status = 'failed', error_details = 'Cancelled by user', updated_at = NOW()
         WHERE id = $1 AND status = 'queued'
         RETURNING id`,
        [id],
      );
      return result.rows.length > 0;
    }

    private mapMigration(row: Record<string, unknown>): MigrationStatus {
      return {
        migrationId: row.id as string,
        repositoryId: row.repository_id as string,
        migrationType: row.migration_type as string,
        status: row.status as MigrationStatus['status'],
        parameters: row.parameters as Record<string, string> | undefined,
        result: (row.result as string) ?? undefined,
        errorDetails: (row.error_details as string) ?? undefined,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      };
    }
}
