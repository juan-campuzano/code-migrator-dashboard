# Implementation Plan: Metrics Summary Dashboard

## Overview

Implement a portfolio-level metrics summary dashboard with a backend aggregation endpoint (`GET /api/metrics/summary`) and a new Angular lazy-loaded module at `/metrics`. The backend computes portfolio score, grade, per-repo summaries, and language distribution. The frontend renders four sub-components: portfolio score card, repository table, language chart, and grade distribution breakdown. All code is TypeScript (Node/Express backend, Angular 17 frontend).

## Tasks

- [x] 1. Add backend types and pure computation functions
  - [x] 1.1 Add `MetricsSummaryResponse`, `RepositorySummary`, and `LanguageDistributionEntry` interfaces to `packages/server/src/models/types.ts`
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 1.2 Create `computePortfolioScore` pure function in `packages/server/src/scoring/FreshnessScorer.ts`
    - Implement weighted average: `Σ(repo.weightedAverage × repo.scoredDependencyCount) / Σ(repo.scoredDependencyCount)`
    - Return 100 when denominator is 0
    - _Requirements: 2.1, 2.2_

  - [x] 1.3 Create `aggregateLanguages` pure function in a new file `packages/server/src/services/metricsUtils.ts`
    - Sum `fileCount` per language across all repositories
    - Compute `proportion = languageFileCount / totalFileCount`
    - Sort descending by `totalFileCount`
    - Return empty array when no language data exists
    - _Requirements: 1.5_

  - [ ]* 1.4 Write property test for `computePortfolioScore`
    - **Property 2: Portfolio score is weighted average by scored dependency count**
    - Generate random arrays of `{ weightedAverage, scoredDependencyCount }`, verify weighted average math and that grade matches `mapScoreToGrade(portfolioScore)`
    - **Validates: Requirements 2.1, 2.3**

  - [ ]* 1.5 Write property test for `aggregateLanguages`
    - **Property 4: Language aggregation preserves total file counts**
    - Generate random `RepositoryLanguage[][]`, verify sums per language and that proportions sum to 1 (within tolerance)
    - **Validates: Requirements 1.5**

- [x] 2. Implement server-side MetricsService and route
  - [x] 2.1 Create `packages/server/src/services/MetricsService.ts`
    - Constructor takes `RepositoryDb`
    - `computeSummary()` method: fetch all repos, their freshness scores, dependencies, languages, and latest ingestion; build `RepositorySummary[]`; compute portfolio score via `computePortfolioScore`; derive grade via `mapScoreToGrade`; aggregate languages via `aggregateLanguages`; return `MetricsSummaryResponse`
    - Repos without freshness scores get `freshnessStatus: 'pending'`, null grade/score, and are excluded from portfolio score
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [x] 2.2 Create `packages/server/src/api/metricsRoutes.ts` with `createMetricsRouter(db: RepositoryDb)`
    - `GET /summary` handler calls `MetricsService.computeSummary()` and returns JSON
    - Wrap in try/catch returning 500 with `{ code: 'INTERNAL_ERROR', message }` on failure
    - _Requirements: 1.1, 1.6_

  - [x] 2.3 Wire the metrics router into `packages/server/src/index.ts` and export from `packages/server/src/api/index.ts`
    - Mount at `/api/metrics`
    - _Requirements: 1.1_

  - [ ]* 2.4 Write property test for summary response completeness
    - **Property 1: Summary response completeness**
    - Generate random sets of repo/freshness/language data, call `computeSummary`, verify all required fields present in response and in each repository entry
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 2.5 Write property test for unscored repositories
    - **Property 3: Unscored repositories excluded from portfolio score and marked pending**
    - Generate mixed scored/unscored repo sets, verify only scored repos contribute to portfolio score and unscored are marked pending with null grade/score
    - **Validates: Requirements 1.3**

  - [ ]* 2.6 Write unit tests for MetricsService edge cases
    - Empty database returns `{ totalRepositories: 0, portfolioScore: 100, portfolioGrade: 'A', repositories: [], languageDistribution: [] }`
    - Database error returns 500 with `INTERNAL_ERROR`
    - All repos with zero scored dependencies returns portfolio score 100
    - _Requirements: 1.2, 1.6, 2.2_

- [x] 3. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create frontend metrics module, models, and service
  - [x] 4.1 Create frontend model types in `packages/web/src/app/metrics/models/metrics.models.ts`
    - Mirror `MetricsSummaryResponse`, `RepositorySummary`, `LanguageDistributionEntry` from backend
    - _Requirements: 1.1, 1.4_

  - [x] 4.2 Create `MetricsService` in `packages/web/src/app/metrics/services/metrics.service.ts`
    - Injectable service with `getSummary(): Observable<MetricsSummaryResponse>` calling `GET /api/metrics/summary`
    - _Requirements: 1.1_

  - [x] 4.3 Create `MetricsModule` in `packages/web/src/app/metrics/metrics.module.ts`
    - Lazy-loaded Angular module with its own child route (`path: ''` → `MetricsSummaryComponent`)
    - Import Angular Material modules, NgxChartsModule, and declare all child components
    - _Requirements: 3.4_

  - [x] 4.4 Add lazy-loaded route for `/metrics` in `packages/web/src/app/app.routes.ts`
    - `{ path: 'metrics', loadChildren: () => import('./metrics/metrics.module').then(m => m.MetricsModule) }`
    - _Requirements: 3.4_

- [x] 5. Implement MetricsSummaryComponent (container)
  - [x] 5.1 Create `MetricsSummaryComponent` in `packages/web/src/app/metrics/metrics-summary.component.ts`
    - Call `MetricsService.getSummary()` on init
    - Manage loading, error, and empty states
    - Display "Repository Dashboard" back-navigation link to `/`
    - Display error message with retry button on API failure
    - Display empty state message with link to `/` when no repositories
    - Pass data to child components
    - Follow the frontend-design skill guidelines for distinctive styling
    - _Requirements: 3.3, 4.4, 8.1, 8.2, 8.3_

- [x] 6. Implement child display components
  - [x] 6.1 Create `PortfolioScoreComponent` in `packages/web/src/app/metrics/components/portfolio-score.component.ts`
    - Display portfolio grade as large color-coded letter (A=green #4caf50, B=blue #2196f3, C=yellow #ff9800, D=orange #f57c00, E=red #f44336)
    - Display numeric score rounded to 1 decimal place
    - Display total repository count
    - Show `mat-progress-spinner` while loading
    - Follow the frontend-design skill guidelines for distinctive styling
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Create `RepositoryTableComponent` in `packages/web/src/app/metrics/components/repository-table.component.ts`
    - Material table with columns: name, source type, grade (color-coded), score, total deps, primary language, last ingestion date
    - Default sort: ascending by freshness score (lowest first), pending repos at top
    - Display "Pending" for repos without freshness scores
    - Row click navigates to `/?repo={id}`
    - Follow the frontend-design skill guidelines for distinctive styling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.3 Create `LanguageChartComponent` in `packages/web/src/app/metrics/components/language-chart.component.ts`
    - ngx-charts pie or bar chart showing aggregated language distribution with name and percentage
    - Display "No language data available" when empty
    - Follow the frontend-design skill guidelines for distinctive styling
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.4 Create `GradeDistributionComponent` in `packages/web/src/app/metrics/components/grade-distribution.component.ts`
    - Display count of repos per grade (A, B, C, D, E, Pending), color-coded
    - Show 0 for empty categories
    - Follow the frontend-design skill guidelines for distinctive styling
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 6.5 Write property test for grade color mapping
    - **Property 5: Grade color mapping consistency**
    - Generate random grades from {A, B, C, D, E}, verify correct color applied
    - **Validates: Requirements 4.1, 5.2, 7.2**

  - [ ]* 6.6 Write property test for score display formatting
    - **Property 6: Score display formatting**
    - Generate random scores in [0, 100], verify formatting to exactly 1 decimal place
    - **Validates: Requirements 4.2**

  - [ ]* 6.7 Write property test for pending repository display
    - **Property 7: Pending repositories display "Pending"**
    - Generate repo summaries with `freshnessStatus: 'pending'`, verify "Pending" text in grade and score columns
    - **Validates: Requirements 5.3**

  - [ ]* 6.8 Write property test for default table sort
    - **Property 8: Default table sort is ascending by freshness score**
    - Generate random repo summary arrays, verify default sort is ascending by score with null/pending at top
    - **Validates: Requirements 5.5**

  - [ ]* 6.9 Write property test for language chart rendering
    - **Property 9: Language chart shows name and proportion**
    - Generate random non-empty language distributions, verify each entry includes language name and percentage
    - **Validates: Requirements 6.2**

  - [ ]* 6.10 Write property test for grade distribution counts
    - **Property 10: Grade distribution counts all categories**
    - Generate random repo summaries, verify exactly 6 categories (A–E + Pending), counts sum to total
    - **Validates: Requirements 7.1**

- [x] 7. Add dashboard navigation link
  - [x] 7.1 Add "Metrics Overview" navigation element to the existing `DashboardComponent` header in `packages/web/src/app/dashboard/dashboard.component.ts`
    - Button or link labeled "Metrics Overview" that routes to `/metrics`
    - _Requirements: 3.1, 3.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All frontend components should follow the frontend-design skill guidelines at `.agents/skills/frontend-design/SKILL.md` for distinctive, production-grade styling
