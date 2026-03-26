import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { RepositoryDb } from './db/RepositoryDb';
import { RegistryClient } from './scoring/RegistryClient';
import { FreshnessService } from './services/FreshnessService';
import { IngestionService } from './services/IngestionService';
import { TokenService } from './services/TokenService';
import { CopilotProvider, ClaudeProvider } from './services/AIProvider';
import { GitHubService } from './services/GitHubService';
import { MigrationAgent, parseMigrationAgentConfig } from './services/MigrationAgent';
import {
  createFreshnessRouter,
  createIngestionRouter,
  createMetricsRouter,
  createRepositoryRouter,
  createTokenRouter,
  createMigrationRouter,
} from './api';
import type { ApiError } from './models/types';
import { validateEnv } from './config/validateEnv';
import { validateDbConnection } from './db/validateConnection';
import { MigrationRunner } from './db/MigrationRunner';

// ---------------------------------------------------------------------------
// Database connection pool
// ---------------------------------------------------------------------------

function createPool(): Pool {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return new Pool({
    host: process.env.PG_HOST ?? 'localhost',
    port: Number(process.env.PG_PORT ?? 5432),
    database: process.env.PG_DATABASE ?? 'repo_dashboard',
    user: process.env.PG_USER ?? 'postgres',
    password: process.env.PG_PASSWORD ?? '',
  });
}

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

function createApp(pool: Pool, db: RepositoryDb, ingestionService: IngestionService, tokenService: TokenService, freshnessService: FreshnessService) {
  const app = express();

  app.use(express.json());

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: corsOrigin }));

  // Health check – verifies database connectivity
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'disconnected' });
    }
  });

  // Mount route handlers
  app.use('/api/ingestions', createIngestionRouter(ingestionService, tokenService));
  app.use('/api/repositories', createRepositoryRouter(db));
  app.use('/api/repositories', createFreshnessRouter(db, freshnessService));
  if (tokenService) {
    app.use('/api/settings/tokens', createTokenRouter(tokenService));
  }
  app.use('/api/metrics', createMetricsRouter(db));
  app.use('/api/migrations', createMigrationRouter(db));

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    const apiError: ApiError = {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred.',
    };
    res.status(500).json(apiError);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Startup sequence
// ---------------------------------------------------------------------------

async function main() {
  // Step 1: Validate environment variables
  const envResult = validateEnv(process.env as Record<string, string | undefined>);

  if (envResult.warnings.length > 0) {
    for (const warning of envResult.warnings) {
      console.warn(`[env warning] ${warning}`);
    }
  }

  if (!envResult.isValid) {
    for (const error of envResult.errors) {
      console.error(`[env error] ${error}`);
    }
    process.exit(1);
  }

  // Step 2: Create database connection pool
  const pool = createPool();

  // Step 3: Validate database connection
  try {
    await validateDbConnection(pool);
  } catch (error) {
    console.error('Database connection validation failed. Exiting.');
    process.exit(1);
  }

  // Step 4: Run database migrations
  try {
    const migrationRunner = new MigrationRunner();
    await migrationRunner.run(pool);
  } catch (error) {
    console.error('Migration execution failed. Exiting.');
    process.exit(1);
  }

  // Step 5: Set up services and start HTTP server
  const db = new RepositoryDb(pool);

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY ?? '';
  const tokenService = encryptionKey
    ? new TokenService(pool, encryptionKey)
    : (undefined as unknown as TokenService);

  const registryClient = new RegistryClient();
  const freshnessService = new FreshnessService(db, registryClient);

  const ingestionService = new IngestionService(db, { freshnessService });

  // Step 6: Set up migration agent (opt-in via AI_PROVIDER_API_KEY)
  let migrationAgent: MigrationAgent | null = null;
  const aiProviderApiKey = process.env.AI_PROVIDER_API_KEY;

  if (aiProviderApiKey) {
    const aiProviderType = process.env.AI_PROVIDER_TYPE ?? 'copilot';
    const aiProviderEndpoint = process.env.AI_PROVIDER_ENDPOINT;
    const aiProviderModel = process.env.AI_PROVIDER_MODEL;

    let aiProvider: import('./models/types').AIProvider;

    if (aiProviderType === 'claude') {
      aiProvider = new ClaudeProvider({
        apiKey: aiProviderApiKey,
        endpoint: aiProviderEndpoint,
        model: aiProviderModel,
      });
    } else {
      aiProvider = new CopilotProvider({
        apiKey: aiProviderApiKey,
        endpoint: aiProviderEndpoint ?? 'https://models.inference.ai.azure.com',
        model: aiProviderModel,
      });
    }

    const githubService = new GitHubService();
    const agentConfig = parseMigrationAgentConfig(process.env as Record<string, string | undefined>);

    migrationAgent = new MigrationAgent(
      db,
      tokenService,
      freshnessService,
      aiProvider,
      githubService,
      agentConfig,
    );
    migrationAgent.start();
    console.log('Migration agent started.');
  } else {
    console.log('Migration agent disabled (AI_PROVIDER_API_KEY not set).');
  }

  const app = createApp(pool, db, ingestionService, tokenService, freshnessService);

  const PORT = Number(process.env.PORT ?? 3000);

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------

  function shutdown(signal: string) {
    console.log(`Received ${signal}. Shutting down gracefully...`);

    const forceTimeout = setTimeout(() => {
      console.error('Graceful shutdown timed out after 30s. Forcing exit.');
      process.exit(1);
    }, 30_000);
    forceTimeout.unref();

    server.close(async () => {
      try {
        if (migrationAgent) {
          console.log('Stopping migration agent...');
          await migrationAgent.stop();
          console.log('Migration agent stopped.');
        }
        await pool.end();
        clearTimeout(forceTimeout);
        console.log('Database pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();

export default createApp;
