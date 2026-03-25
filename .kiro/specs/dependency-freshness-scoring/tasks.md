# Implementation Plan: Dependency Freshness Scoring

## Overview

Implement dependency freshness scoring across the full stack: server-side scoring pipeline (RegistryClient, VersionResolver, FreshnessScorer, FreshnessService), database persistence, REST API endpoints, and Angular dashboard components. Each task builds incrementally, wiring into the existing codebase at each step.

## Tasks

- [x] 1. Add data models and database migration
  - [x] 1.1 Add freshness TypeScript types to `packages/server/src/models/types.ts`
    - Add `RepositoryGrade`, `DependencyFreshnessScore`, `FreshnessResult` interfaces as defined in the design
    - _Requirements: 3.1, 4.2, 5.1_
  - [x] 1.2 Create database migration `packages/server/src/db/migrations/002_freshness_scores.sql`
    - Create `repository_freshness` table with grade, weighted_average, computed_at, unique on repository_id
    - Create `dependency_freshness_scores` table with per-dependency score fields, ON DELETE CASCADE from repository_freshness
    - Add indexes on `freshness_id` and `repository_id`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 1.3 Add freshness database methods to `packages/server/src/db/RepositoryDb.ts`
    - Implement `upsertFreshnessScores(repositoryId, ingestionId, result)` — uses a transaction to delete old scores and insert new ones (upsert pattern)
    - Implement `getFreshnessScores(repositoryId)` — joins `repository_freshness` and `dependency_freshness_scores`, returns `FreshnessResult | null`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Implement VersionResolver
  - [x] 2.1 Create `packages/server/src/scoring/VersionResolver.ts`
    - Implement `resolveVersion(ecosystem, constraint)` pure function returning `VersionResolveResult`
    - Handle npm/cargo semver ranges (`^`, `~`, `>=`, ranges), pypi PEP 440 (`~=`, `>=,<`), maven version ranges (`[1.2,2.0)`), rubygems pessimistic constraints (`~>`), go module versions (strip `v` prefix, handle pseudo-versions)
    - Return `{ resolved: null, unpinned: true }` for empty/undefined constraints
    - Return `{ resolved: null, warning: "..." }` for unparseable constraints
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 2.2 Write unit tests for VersionResolver in `packages/server/src/scoring/VersionResolver.test.ts`
    - Test each ecosystem's constraint parsing with representative examples
    - Test empty/undefined constraints return unpinned
    - Test unparseable constraints return warning
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Implement FreshnessScorer
  - [x] 3.1 Create `packages/server/src/scoring/FreshnessScorer.ts`
    - Implement `scoreOne(resolved, latest)` — compute score based on major/minor/patch diffs with weights (major×30, minor×5, patch×1), clamp to [0,100], handle prerelease
    - Implement `aggregate(scores)` — weighted average with production weight 2, development weight 1; return grade
    - Implement `mapScoreToGrade(score)` — A: 90-100, B: 70-89, C: 50-69, D: 30-49, E: 0-29
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - [ ]* 3.2 Write property test for scoreOne in `packages/server/src/scoring/FreshnessScorer.test.ts`
    - **Property 1: Score is always in [0, 100] range**
    - **Validates: Requirements 3.1**
  - [ ]* 3.3 Write property test for aggregate grade consistency in `packages/server/src/scoring/FreshnessScorer.test.ts`
    - **Property 2: Grade always falls within the correct threshold range for the computed weighted average (round-trip property)**
    - **Validates: Requirements 4.2, 4.4**
  - [ ]* 3.4 Write unit tests for FreshnessScorer in `packages/server/src/scoring/FreshnessScorer.test.ts`
    - Test scoreOne: identical versions → 100, 4+ major versions behind → 0, prerelease handling, intermediate cases
    - Test aggregate: production vs development weighting, zero dependencies → grade A
    - Test mapScoreToGrade: boundary values at 0, 29, 30, 49, 50, 69, 70, 89, 90, 100
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement RegistryClient
  - [x] 5.1 Create `packages/server/src/scoring/RegistryClient.ts`
    - Implement `fetchLatest(ecosystem, packageName)` dispatching to correct registry URL (npm, pypi, cargo, maven, rubygems, go)
    - Implement `fetchMany(deps)` with concurrency-limited pool using `p-limit` (add as dependency)
    - Add in-memory cache with configurable TTL, keyed by `ecosystem::packageName`
    - Handle HTTP errors/timeouts: record error string, return `latestVersion: null`
    - Handle 404: return `latestVersion: null` with no error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [ ]* 5.2 Write unit tests for RegistryClient in `packages/server/src/scoring/RegistryClient.test.ts`
    - Mock HTTP calls, test each registry URL construction
    - Test caching behavior (second call returns cached result)
    - Test error handling (HTTP error, timeout, 404)
    - Test concurrency limiting
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 6. Implement FreshnessService and integrate with IngestionService
  - [x] 6.1 Create `packages/server/src/services/FreshnessService.ts`
    - Implement `computeScores(repositoryId, ingestionId?)` orchestrating the full pipeline: load deps → fetchMany → resolveVersion → scoreOne → aggregate → upsertFreshnessScores
    - Implement `isScoring(repositoryId)` using in-memory Set for conflict detection
    - Ensure in-progress set is cleaned up in finally block
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 5.2, 5.3, 8.1, 8.3_
  - [x] 6.2 Integrate FreshnessService into IngestionService
    - After successful ingestion (status: completed), call `freshnessService.computeScores(repositoryId, ingestionId)`
    - Pass FreshnessService as optional dependency to IngestionService constructor
    - Catch and log freshness scoring errors without failing the ingestion
    - _Requirements: 8.1_
  - [x] 6.3 Wire FreshnessService into server startup in `packages/server/src/index.ts`
    - Instantiate RegistryClient and FreshnessService
    - Pass FreshnessService to IngestionService and to freshness routes
    - Export FreshnessService from `packages/server/src/services/index.ts`
    - _Requirements: 8.1_
  - [ ]* 6.4 Write unit tests for FreshnessService in `packages/server/src/services/FreshnessService.test.ts`
    - Mock RepositoryDb, RegistryClient; test full pipeline orchestration
    - Test conflict detection (isScoring returns true while computing)
    - Test cleanup of in-progress set on error
    - _Requirements: 8.1, 8.3_

- [x] 7. Implement REST API endpoints
  - [x] 7.1 Create `packages/server/src/api/freshnessRoutes.ts`
    - `GET /api/repositories/:id/freshness` — return freshness result from DB, support optional `ecosystem` query param for filtering, return 404 if no scores or repository not found
    - `POST /api/repositories/:id/freshness/refresh` — trigger re-computation, return 409 if already scoring, return 400 if no completed ingestion
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.2, 8.3, 8.4_
  - [x] 7.2 Register freshness routes in `packages/server/src/api/index.ts` and mount in `packages/server/src/index.ts`
    - Export `createFreshnessRouter` from api index
    - Mount at `/api/repositories` in the Express app
    - _Requirements: 6.1, 8.2_
  - [ ]* 7.3 Write unit tests for freshnessRoutes in `packages/server/src/api/freshnessRoutes.test.ts`
    - Test GET returns freshness data, 404 for missing scores, ecosystem filtering
    - Test POST triggers refresh, 409 on conflict, 400 on no ingestion
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.2, 8.3, 8.4_

- [x] 8. Checkpoint - Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add frontend freshness models and service methods
  - [x] 9.1 Add freshness interfaces to `packages/web/src/app/dashboard/models/repository.models.ts`
    - Add `FreshnessResponse`, `DependencyFreshnessScore`, `RepositoryGrade` types matching the API response shape
    - _Requirements: 6.1, 6.2_
  - [x] 9.2 Add freshness methods to `packages/web/src/app/dashboard/services/repository.service.ts`
    - `getFreshness(repositoryId, ecosystem?)` — GET call with optional ecosystem query param
    - `refreshFreshness(repositoryId)` — POST call to refresh endpoint
    - _Requirements: 6.1, 8.2_

- [x] 10. Implement freshness grade component
  - [x] 10.1 Create `packages/web/src/app/dashboard/components/freshness-grade/freshness-grade.component.ts`
    - Display letter grade with color indicator (A=green, B=light-green, C=yellow, D=orange, E=red)
    - Display weighted average as numeric percentage
    - Display computed_at timestamp
    - Include a refresh button that emits an event
    - Show loading indicator while data is loading
    - Show "not computed" message when no scores available
    - Follow the frontend-design skill guidelines for distinctive, polished styling
    - _Requirements: 7.1, 7.2, 7.6, 7.7_

- [x] 11. Implement freshness dependency table component
  - [x] 11.1 Create `packages/web/src/app/dashboard/components/freshness-table/freshness-table.component.ts`
    - Material table showing: name, ecosystem, current version, latest version, score, dependency type
    - Support sorting by score, name, or ecosystem via MatSort
    - Ecosystem filter dropdown using MatSelect
    - Show loading indicator while data is loading
    - Follow the frontend-design skill guidelines for distinctive, polished styling
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

- [x] 12. Integrate freshness components into dashboard
  - [x] 12.1 Register components in `packages/web/src/app/dashboard/dashboard.module.ts`
    - Declare FreshnessGradeComponent and FreshnessTableComponent
    - Add MatSortModule and MatProgressSpinnerModule imports if not already present
    - _Requirements: 7.1, 7.3_
  - [x] 12.2 Add freshness section to `packages/web/src/app/dashboard/dashboard.component.ts`
    - Add freshness data properties and loading state
    - Fetch freshness data when a repository is selected (alongside existing metadata fetch)
    - Handle refresh button click: call refreshFreshness, then re-fetch after completion
    - Wire freshness-grade and freshness-table components into the template between the metrics grid and dependency panel
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (score range, grade consistency)
- The server uses TypeScript with Vitest for testing; the frontend uses Angular 17 with Material
- `p-limit` needs to be added as a dependency for concurrency control in RegistryClient
- Frontend components should follow the frontend-design skill guidelines for distinctive styling
