# Implementation Tasks: Background Migration Agent

## Task 1: Add new TypeScript interfaces and data models

- [x] 1.1 Add `UpgradeTarget`, `FileChange`, `AIProviderRequest`, `AIProviderResponse`, `MigrationParameters` interfaces to `packages/server/src/models/types.ts`
- [x] 1.2 Add `AIProvider` interface to `packages/server/src/models/types.ts`

## Task 2: Extend RepositoryDb with migration methods

- [x] 2.1 Add `claimNextJob()` method using `SELECT FOR UPDATE SKIP LOCKED` to `packages/server/src/db/RepositoryDb.ts`
- [x] 2.2 Add `updateMigrationStatus()` method to `packages/server/src/db/RepositoryDb.ts`
- [x] 2.3 Add `listMigrations()` method with optional `repositoryId` and `status` filters to `packages/server/src/db/RepositoryDb.ts`
- [x] 2.4 Add `cancelMigration()` method to `packages/server/src/db/RepositoryDb.ts`
- [x] 2.5 Write property tests for `claimNextJob`, `listMigrations`, and `cancelMigration` in `packages/server/src/db/RepositoryDb.migrations.test.ts`
  - [x] 2.5.1 Property 1: Claim returns oldest queued job and transitions to running
  - [x] 2.5.2 Property 8: List migrations filtering and ordering
  - [x] 2.5.3 Property 9: Cancel succeeds only for queued jobs

## Task 3: Implement GitHubService

- [x] 3.1 Create `packages/server/src/services/GitHubService.ts` with `createBranch`, `commitChanges`, `createPullRequest`, `getFileContent`, `getDefaultBranch` methods
- [x] 3.2 Write unit tests for GitHubService in `packages/server/src/services/GitHubService.test.ts` with mocked fetch
- [x] 3.3 Write property test for branch name format (Property 4) in `packages/server/src/services/GitHubService.test.ts`

## Task 4: Implement AIProvider and CopilotProvider

- [x] 4.1 Create `packages/server/src/services/AIProvider.ts` with `CopilotProvider` class implementing the `AIProvider` interface
- [x] 4.2 Implement system prompt construction with agent instructions and repository context
- [x] 4.3 Implement response parsing to extract file changes and PR description from AI output
- [x] 4.4 Write unit tests for CopilotProvider in `packages/server/src/services/AIProvider.test.ts`
- [x] 4.5 Write property tests in `packages/server/src/services/AIProvider.test.ts`
  - [x] 4.5.1 Property 3: Agent instruction precedence
  - [x] 4.5.2 Property 5: PR description contains required information
  - [x] 4.5.3 Property 6: Fallback PR description on AI failure

## Task 5: Implement MigrationAgent

- [x] 5.1 Create `packages/server/src/services/MigrationAgent.ts` with poll loop, job processing orchestration, and start/stop lifecycle
- [x] 5.2 Implement upgradeAll logic: load freshness scores, filter by threshold, build UpgradeTarget array
- [x] 5.3 Implement agent instructions loading: fetch `.migration-agent.md` from repo, fallback to defaults, customInstructions override
- [x] 5.4 Implement job processing flow: claim → load context → call AI → create branch → commit → open PR → update status
- [x] 5.5 Implement error handling: catch all error types, mark job failed with details, continue polling
- [x] 5.6 Implement graceful shutdown with configurable timeout
- [x] 5.7 Write unit tests for MigrationAgent in `packages/server/src/services/MigrationAgent.test.ts`
- [x] 5.8 Write property tests in `packages/server/src/services/MigrationAgent.test.ts`
  - [x] 5.8.1 Property 2: UpgradeAll selects dependencies below freshness threshold
  - [x] 5.8.2 Property 7: Job outcome correctly recorded
  - [x] 5.8.3 Property 10: Errors mark job as failed with descriptive details
  - [x] 5.8.4 Property 11: Environment variable configuration parsing

## Task 6: Extend API routes

- [x] 6.1 Add GitHub-only validation to `POST /api/migrations` in `packages/server/src/api/migrationRoutes.ts`
- [x] 6.2 Add `GET /api/migrations` list endpoint with `repositoryId` and `status` query param filtering to `packages/server/src/api/migrationRoutes.ts`
- [x] 6.3 Add `POST /api/migrations/:id/cancel` endpoint to `packages/server/src/api/migrationRoutes.ts`
- [x] 6.4 Update `createMigrationRouter` to accept `RepositoryDb` (already does) — no change needed, just verify
- [x] 6.5 Write unit tests for new routes in `packages/server/src/api/migrationRoutes.test.ts`

## Task 7: Server startup integration and environment config

- [x] 7.1 Add `AI_PROVIDER_TYPE`, `AI_PROVIDER_API_KEY`, `AI_PROVIDER_ENDPOINT`, `MIGRATION_POLL_INTERVAL_MS`, `DASHBOARD_BASE_URL` validation to `packages/server/src/config/validateEnv.ts`
- [x] 7.2 Wire up `CopilotProvider`, `GitHubService`, and `MigrationAgent` in `packages/server/src/index.ts` startup sequence
- [x] 7.3 Add `agent.stop()` to the graceful shutdown handler in `packages/server/src/index.ts`
- [x] 7.4 Export new services from `packages/server/src/services/index.ts`
