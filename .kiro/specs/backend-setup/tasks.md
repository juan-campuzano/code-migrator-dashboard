# Implementation Plan: Backend Setup

## Overview

Incrementally build the missing operational infrastructure for the Repository Metadata Dashboard backend. Each task builds on the previous, starting with pure utility functions (environment validation, error mapping), then database components (connection validation, migration runner), then API endpoints (repository listing, health check, CORS), and finally wiring everything together in `index.ts` with graceful shutdown. Property-based tests use `fast-check` + `vitest`.

## Tasks

- [x] 1. Implement environment configuration validation
  - [x] 1.1 Create `backend/src/config/validateEnv.ts` with the `validateEnv` function
    - Accept a `Record<string, string | undefined>` parameter representing environment variables
    - Return an `EnvValidationResult` with `isValid`, `errors[]`, and `warnings[]`
    - Validate that either `DATABASE_URL` or the combination of `PG_HOST` + `PG_DATABASE` + `PG_USER` are set
    - If `TOKEN_ENCRYPTION_KEY` is provided, validate it is exactly 64 hex characters or valid base64 decoding to 32 bytes
    - If `TOKEN_ENCRYPTION_KEY` is absent, add a warning that token management endpoints are disabled
    - Export the `EnvValidationResult` interface
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 1.2 Write property test: environment validation rejects missing database configuration
    - **Property 5: Environment validation rejects missing database configuration**
    - Use `fast-check` to generate env objects lacking both `DATABASE_URL` and at least one of `PG_HOST`, `PG_DATABASE`, `PG_USER`
    - Assert `isValid` is `false` and at least one error string names the missing variable(s)
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 1.3 Write property test: environment validation rejects invalid TOKEN_ENCRYPTION_KEY
    - **Property 6: Environment validation rejects invalid TOKEN_ENCRYPTION_KEY**
    - Use `fast-check` to generate strings that are neither 64 hex chars nor valid base64 decoding to 32 bytes
    - Assert `isValid` is `false` with an error naming `TOKEN_ENCRYPTION_KEY`
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 1.4 Write unit tests for `validateEnv` edge cases
    - Test that missing `TOKEN_ENCRYPTION_KEY` produces a warning (not error) and `isValid` remains `true` when DB config is valid
    - Test that valid `DATABASE_URL` alone passes validation
    - Test that valid `PG_HOST` + `PG_DATABASE` + `PG_USER` combination passes validation
    - Test file: `backend/src/config/validateEnv.test.ts`
    - _Requirements: 4.1, 4.4_

- [x] 2. Implement ingestion error mapping
  - [x] 2.1 Create `backend/src/api/mapIngestionError.ts` with the `mapIngestionError` function
    - Accept an `unknown` error parameter
    - Return `{ status: number; body: ApiError }` with correct HTTP status and error shape
    - Map `AUTH_ERROR` → 401, `RATE_LIMIT_EXCEEDED` → 429, `NOT_FOUND` → 404, all others → 500
    - Populate `provider` field from adapter error for auth/not-found errors
    - Preserve `retryAfter` value for rate-limit errors
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Write property test: ingestion error mapping produces correct HTTP status and error shape
    - **Property 7: Ingestion error mapping produces correct HTTP status and error shape**
    - Use `fast-check` to generate random error codes (`AUTH_ERROR`, `RATE_LIMIT_EXCEEDED`, `NOT_FOUND`, other) and provider names
    - Assert correct HTTP status, `ApiError.code`, `provider` for auth/not-found, and `retryAfter` for rate-limit
    - Test file: `backend/src/api/mapIngestionError.test.ts`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 3. Implement database connection validation
  - [x] 3.1 Create `backend/src/db/validateConnection.ts` with the `validateDbConnection` function
    - Accept a `Pool` parameter
    - Execute `SELECT 1` as a test query
    - On success: log confirmation message
    - On failure: log descriptive error including configured host/port, then throw
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.2 Write unit tests for `validateDbConnection`
    - Test that successful query logs confirmation message
    - Test that failed query logs host/port and throws
    - Mock the `Pool.query` method
    - Test file: `backend/src/db/validateConnection.test.ts`
    - _Requirements: 2.2, 2.3_

- [x] 4. Implement MigrationRunner
  - [x] 4.1 Create `backend/src/db/MigrationRunner.ts` with the `MigrationRunner` class
    - Implement `run(pool: Pool): Promise<number>` method
    - Create `schema_migrations` table using `CREATE TABLE IF NOT EXISTS` with `filename` (PK) and `applied_at` columns
    - Read `*.sql` files from `backend/src/db/migrations/` sorted by filename
    - Compare against `schema_migrations` to find pending migrations
    - Execute each pending migration inside a transaction, insert row into `schema_migrations` after success
    - Log count of newly applied migrations on completion
    - On failure: log error with failing filename and re-throw
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 4.2 Write property test: migrations execute in sorted order and are tracked
    - **Property 1: Migrations execute in sorted order and are tracked**
    - Generate random sets of migration filenames, verify `schema_migrations` contents and ordering match lexicographic sort
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [ ]* 4.3 Write property test: migration runner is idempotent
    - **Property 2: Migration runner is idempotent**
    - Run MigrationRunner twice on the same set of files, verify second run returns 0 and `schema_migrations` is unchanged
    - **Validates: Requirements 1.3**

  - [ ]* 4.4 Write property test: failed migration prevents completion
    - **Property 3: Failed migration prevents completion**
    - Generate migration sets with one invalid SQL entry, verify only preceding migrations are recorded
    - **Validates: Requirements 1.4**

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add repository listing endpoint and health check
  - [x] 6.1 Add `listRepositories()` method to `backend/src/db/RepositoryDb.ts`
    - Query all repositories returning `id`, `name`, `sourceType`, `sourceIdentifier`, `createdAt`, `updatedAt`
    - Return `Repository[]` using the existing `mapRepository` helper
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Add `GET /` handler to `backend/src/api/repositoryRoutes.ts`
    - Call `db.listRepositories()` and return the JSON array
    - Return `[]` with 200 when no repositories exist
    - Return 500 with `ApiError { code: "INTERNAL_ERROR" }` on DB errors
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 6.3 Write property test: repository listing returns all stored repositories with required fields
    - **Property 4: Repository listing returns all stored repositories with required fields**
    - Generate random repository data, insert via `RepositoryDb`, call listing, verify all returned with correct fields and matching IDs
    - Test file: `backend/src/api/repositoryRoutes.test.ts`
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 6.4 Write unit tests for repository listing edge cases
    - Test empty database returns `[]` with 200
    - Test DB error returns 500 with `INTERNAL_ERROR`
    - Test file: `backend/src/api/repositoryRoutes.test.ts`
    - _Requirements: 3.3, 3.4_

  - [x] 6.5 Enhance health endpoint in `backend/src/index.ts` (or create `backend/src/api/healthRoutes.ts`)
    - Replace static `/health` handler with one that executes `SELECT 1` against the pool
    - Return 200 with `{ status: "ok", database: "connected" }` when DB is reachable
    - Return 503 with `{ status: "degraded", database: "disconnected" }` when DB is unreachable
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 6.6 Write unit tests for health endpoint
    - Test 200 response with `{ status: "ok", database: "connected" }` when DB is up
    - Test 503 response with `{ status: "degraded", database: "disconnected" }` when DB is down
    - Test file: `backend/src/api/healthRoutes.test.ts`
    - _Requirements: 5.2, 5.3_

- [x] 7. Wire CORS, startup sequence, ingestion error mapping, and graceful shutdown into `backend/src/index.ts`
  - [x] 7.1 Integrate CORS configuration
    - Read `CORS_ORIGIN` from environment; default to `'*'` when unset
    - Replace `app.use(cors())` with `app.use(cors({ origin: corsOrigin }))`
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 7.2 Write property test: CORS origin restriction matches configuration
    - **Property 8: CORS origin restriction matches configuration**
    - Generate random non-empty origin strings, verify `Access-Control-Allow-Origin` header matches the configured value and is not `*`
    - Test file: `backend/src/api/corsConfig.test.ts`
    - **Validates: Requirements 7.1**

  - [ ]* 7.3 Write unit tests for CORS defaults
    - Test that when `CORS_ORIGIN` is not set, all origins are allowed
    - Test that preflight OPTIONS returns appropriate headers
    - _Requirements: 7.2, 7.3_

  - [x] 7.4 Integrate startup sequence in `backend/src/index.ts`
    - Restructure `index.ts` to follow the ordered startup: `validateEnv` → `createPool` → `validateDbConnection` → `MigrationRunner.run` → `app.listen`
    - On `validateEnv` errors: log each error and call `process.exit(1)`
    - On `validateEnv` warnings: log warnings and continue
    - On DB connection failure: log error and call `process.exit(1)`
    - On migration failure: log error and call `process.exit(1)`
    - _Requirements: 1.1, 2.1, 2.2, 4.1, 4.3_

  - [x] 7.5 Integrate ingestion error mapping into `backend/src/api/ingestionRoutes.ts`
    - Import `mapIngestionError` and use it in the catch block of the POST `/` handler
    - Replace the generic 500 catch with structured error responses using the mapping function
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.6 Enhance graceful shutdown with 30-second timeout
    - Add a 30-second `setTimeout` with `unref()` that calls `process.exit(1)` if shutdown hasn't completed
    - Clear the timeout on successful shutdown
    - Maintain existing behavior: `server.close` → `pool.end` → `process.exit(0)`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use `fast-check` (already a dev dependency) with `vitest`
- Checkpoints ensure incremental validation
- The startup sequence is strictly ordered: env validation → pool → DB connection → migrations → HTTP server
