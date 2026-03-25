# Implementation Plan: Repository Metadata Dashboard

## Overview

Implement a full-stack repository metadata dashboard with a TypeScript/Node.js/Express backend, PostgreSQL database, and Angular frontend. The implementation follows the ingestion pipeline pattern: Source Adapters → Scanner → Database → Dashboard. Tasks are ordered to build core interfaces first, then the ingestion pipeline, then the dashboard, with migration placeholders wired in at the end.

## Tasks

- [x] 1. Set up project structure, database schema, and core TypeScript interfaces
  - [x] 1.1 Create backend project structure with Express and TypeScript configuration
    - Initialize Node.js project with TypeScript, Express, and PostgreSQL client (pg)
    - Set up `src/` directory with folders: `adapters/`, `scanner/`, `parsers/`, `services/`, `api/`, `models/`, `db/`
    - Configure tsconfig.json, install dependencies (express, pg, fast-check for testing, toml/xml parsers)
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create PostgreSQL migration script with all tables from the design
    - Create SQL migration file with all tables: repositories, ingestions, repository_languages, repository_frameworks, repository_dependencies, repository_file_trees, repository_metadata_extra, access_tokens, migrations
    - Include all constraints, UNIQUE indexes, CHECK constraints, and JSONB columns as specified in the design
    - _Requirements: 1.2, 1.3, 1.10_

  - [x] 1.3 Define core TypeScript interfaces and types
    - Create type definitions for: FileEntry, FileContent, FetchResult, SourceAdapter, Technology, Dependency, ScanResult, ScanError, ParsedDependency, ManifestParseResult, ParseError, ManifestParser, RepositorySource, IngestionRequest, IngestionRecord, Repository, RepositoryLanguage, RepositoryFramework, RepositoryDependency, RepositoryMetadata, ApiError
    - _Requirements: 1.1, 1.2, 2.1, 2.4, 3.1_

- [x] 2. Implement manifest parsers
  - [x] 2.1 Implement PackageJsonParser for package.json files
    - Parse JSON, extract dependencies and devDependencies with version constraints
    - Classify dependencies as production or development
    - Handle malformed entries by skipping and logging errors
    - _Requirements: 5.1, 3.1, 3.3, 3.4_

  - [x] 2.2 Implement RequirementsTxtParser for requirements.txt files
    - Parse line-based format, extract package names and version specifiers
    - Skip comments and blank lines, handle malformed lines gracefully
    - _Requirements: 5.2, 3.1, 3.4_

  - [x] 2.3 Implement PyprojectTomlParser for pyproject.toml files
    - Parse TOML format, extract dependencies from `[project.dependencies]` and `[project.optional-dependencies]`
    - Distinguish production vs development dependencies
    - _Requirements: 5.2, 3.1, 3.3, 3.4_

  - [x] 2.4 Implement PomXmlParser for pom.xml files
    - Parse XML, extract `<dependency>` elements with groupId, artifactId, version
    - Handle `<scope>test</scope>` as development dependencies
    - _Requirements: 5.3, 3.1, 3.3, 3.4_

  - [x] 2.5 Implement BuildGradleParser for build.gradle files
    - Use regex-based parsing to extract dependencies from `implementation`, `testImplementation`, `compile`, `testCompile` blocks
    - _Requirements: 5.3, 3.1, 3.3, 3.4_

  - [x] 2.6 Implement CargoTomlParser for Cargo.toml files
    - Parse TOML format, extract `[dependencies]` and `[dev-dependencies]`
    - _Requirements: 5.4, 3.1, 3.3, 3.4_

  - [x] 2.7 Implement GoModParser for go.mod files
    - Parse line-based format, extract `require` directives
    - _Requirements: 5.5, 3.1, 3.4_

  - [x] 2.8 Implement GemfileParser for Gemfile files
    - Use regex-based parsing to extract `gem` declarations with version constraints
    - Handle `group :development` blocks for dependency type classification
    - _Requirements: 5.6, 3.1, 3.3, 3.4_

  - [ ]* 2.9 Write property tests for manifest parsers
    - **Property 8: Manifest parser extracts all dependencies with correct ecosystem**
    - **Property 9: Production vs development dependency classification**
    - **Property 10: Malformed manifest entry resilience**
    - **Property 12: Dependency extraction round-trip**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.1–5.7**

- [x] 3. Implement Repository Scanner
  - [x] 3.1 Implement language detection from file extensions
    - Create extension-to-language mapping for common languages (TypeScript, JavaScript, Python, Java, Rust, Go, Ruby, C#, etc.)
    - Calculate file count and relative usage proportion per language
    - Skip unrecognized extensions without error
    - _Requirements: 2.1, 7.2_

  - [x] 3.2 Implement framework detection from manifest and config files
    - Detect frameworks by inspecting manifest file dependencies (e.g., react, angular, django, spring-boot, rails)
    - Extract version information from manifest files where available
    - _Requirements: 2.4, 2.5_

  - [x] 3.3 Implement RepositoryScanner that orchestrates language detection, framework detection, and manifest parsing
    - Combine language detection, framework detection, and all manifest parsers
    - Collect errors from individual parsers without stopping the scan
    - Return complete ScanResult with technologies, dependencies, and errors
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 7.1_

  - [ ]* 3.4 Write property tests for scanner
    - **Property 5: Language detection from file extensions**
    - **Property 6: Framework and version detection**
    - **Property 11: Scanner continues on file-level errors**
    - **Validates: Requirements 2.1, 2.4, 2.5, 7.1, 7.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Source Adapters
  - [x] 5.1 Implement URL source classifier
    - Classify URLs as GitHub (`https://github.com/{owner}/{repo}`), Azure DevOps (`https://dev.azure.com/{org}/{project}/_git/{repo}`), or unsupported
    - Return descriptive error listing supported providers for unsupported URLs
    - _Requirements: 8.1, 2.8_

  - [x] 5.2 Implement LocalFilesystemAdapter
    - Walk directory tree using `fs` APIs, build file tree
    - Read manifest and config file contents
    - Return descriptive error for invalid or inaccessible paths
    - _Requirements: 2.1, 2.7_

  - [x] 5.3 Implement GitHubAdapter
    - Use GitHub REST API for tree retrieval and file content fetching
    - Authenticate via Bearer token
    - Handle rate limiting (X-RateLimit headers), 404 responses, network failures, and auth errors
    - Retrieve only manifest files, config files, and file tree metadata
    - _Requirements: 2.2, 8.2, 8.7, 8.8, 8.9, 8.10_

  - [x] 5.4 Implement AzureDevOpsAdapter
    - Use Azure DevOps REST API for tree and file content retrieval
    - Authenticate via Basic auth with PAT
    - Handle rate limiting, 404 responses, network failures, and auth errors
    - Retrieve only necessary files for scanning
    - _Requirements: 2.3, 8.3, 8.7, 8.8, 8.9, 8.10_

  - [ ]* 5.5 Write property tests for source adapters
    - **Property 7: URL source classification**
    - **Property 14: Missing access token produces configuration error**
    - **Property 15: Remote ingestion retrieves only necessary files**
    - **Validates: Requirements 8.1, 8.5, 8.10, 2.8**

- [x] 6. Implement Ingestion Service and database layer
  - [x] 6.1 Implement database access layer for repository metadata
    - Create functions for upserting repositories, languages, frameworks, dependencies, file trees, and metadata_extra
    - Use `ON CONFLICT ... DO UPDATE` for re-ingestion idempotency
    - Create functions for querying repository metadata, ingestion status
    - _Requirements: 1.2, 1.9, 1.10_

  - [x] 6.2 Implement IngestionService orchestration
    - Create ingestion record with status `in_progress`
    - Resolve appropriate source adapter based on source type
    - Fetch contents, run scanner, upsert all metadata to database
    - Update ingestion status to `completed` or `failed` with error details and timestamps
    - Handle missing/invalid access tokens with descriptive errors
    - _Requirements: 1.1, 1.4, 1.6, 1.7, 1.8, 1.9, 8.5, 8.6_

  - [x] 6.3 Implement access token storage with encryption
    - Store and retrieve encrypted access tokens for GitHub and Azure DevOps
    - Use environment-configured encryption key
    - _Requirements: 8.4_

  - [ ]* 6.4 Write property tests for ingestion service
    - **Property 1: Ingestion persists all extracted metadata**
    - **Property 2: Ingestion persists file tree**
    - **Property 3: Ingestion lifecycle status transitions**
    - **Property 4: Re-ingestion is idempotent on repository identity**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9**

- [x] 7. Implement REST API
  - [x] 7.1 Implement ingestion API endpoints
    - `POST /api/ingestions` — trigger new ingestion, return 202 with ingestion ID
    - `GET /api/ingestions/:id` — return ingestion status
    - Validate request body, handle errors with ApiError format
    - _Requirements: 1.4, 1.6, 1.7, 1.8_

  - [x] 7.2 Implement repository metadata API endpoints
    - `GET /api/repositories/:id/metadata` — full metadata
    - `GET /api/repositories/:id/languages` — language breakdown
    - `GET /api/repositories/:id/frameworks` — detected frameworks
    - `GET /api/repositories/:id/dependencies` — dependencies grouped by ecosystem
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 7.3 Implement token settings API endpoints
    - `PUT /api/settings/tokens` — store/update access tokens
    - `GET /api/settings/tokens` — return configured providers without exposing secrets
    - _Requirements: 8.4_

  - [x] 7.4 Implement migration placeholder API endpoints
    - `POST /api/migrations` — accept request, validate repository exists and is ingested, store record with status `queued`, return 202
    - `GET /api/migrations/:id` — return migration status
    - No actual migration logic; placeholder only

  - [ ]* 7.5 Write unit tests for REST API endpoints
    - Test request/response contracts for all endpoints
    - Test error responses (validation errors, not found, auth errors)
    - _Requirements: 1.4, 4.1, 8.4_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Angular frontend
  - [x] 9.1 Set up Angular project and DashboardModule
    - Initialize Angular project with routing
    - Create DashboardModule with component declarations and service providers
    - Install ngx-charts for language visualization
    - _Requirements: 4.1_

  - [x] 9.2 Implement RepositoryService for API communication
    - Create injectable service using HttpClient
    - Methods for: triggering ingestion, fetching metadata, fetching languages/frameworks/dependencies, managing tokens
    - _Requirements: 4.1, 6.1_

  - [x] 9.3 Implement IngestionFormComponent
    - Input field for local path or remote URL
    - Trigger button that calls RepositoryService to POST ingestion
    - _Requirements: 1.4, 6.1_

  - [x] 9.4 Implement IngestionStatusComponent
    - Display current ingestion status and last successful ingestion timestamp
    - Show loading indicator while ingestion is in progress
    - Show error notification if ingestion fails, retaining previous data
    - _Requirements: 4.7, 6.1, 6.2, 6.3_

  - [x] 9.5 Implement LanguageSummaryComponent
    - Display bar or pie chart of language proportions using ngx-charts
    - Show empty state message when no languages detected
    - _Requirements: 4.2, 4.8_

  - [x] 9.6 Implement FrameworkListComponent
    - Table displaying each framework with its version
    - Show empty state message when no frameworks detected
    - _Requirements: 4.3, 4.8_

  - [x] 9.7 Implement DependencyPanelComponent
    - Dependencies grouped by ecosystem with version constraints displayed
    - Show total count per ecosystem
    - Show empty state message when no dependencies found
    - _Requirements: 4.4, 4.5, 4.6, 4.8_

  - [x] 9.8 Implement ErrorBannerComponent and TokenSettingsComponent
    - ErrorBannerComponent: display section-level scan errors
    - TokenSettingsComponent: form for configuring GitHub/Azure DevOps access tokens
    - _Requirements: 7.3, 8.4_

  - [x] 9.9 Implement MigrationTriggerComponent (placeholder)
    - Button to trigger migration, dropdown for migration type, free-text parameters field
    - Display migration status (idle, queued, running, completed, failed)
    - Wire to MigrationService calling placeholder API endpoints

  - [ ]* 9.10 Write property tests for dashboard rendering
    - **Property 13: Dashboard renders complete metadata**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**

- [x] 10. Integration and wiring
  - [x] 10.1 Wire all backend components together
    - Connect Express app with all route handlers
    - Configure database connection pool
    - Set up middleware (error handling, CORS, JSON parsing)
    - Wire ingestion service with adapters, scanner, and database layer
    - _Requirements: 1.1, 1.4_

  - [x] 10.2 Wire Angular frontend to backend API
    - Configure API base URL and proxy for development
    - Connect all dashboard components to RepositoryService
    - Set up routing for dashboard view and token settings
    - _Requirements: 4.1, 6.1_

  - [ ]* 10.3 Write integration tests for end-to-end ingestion flow
    - Test local filesystem ingestion through API to database to dashboard data fetch
    - Test error scenarios (invalid path, missing token)
    - _Requirements: 1.1, 1.4, 1.7, 1.8, 7.1_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration agent is a placeholder — only the API contract and UI shell are implemented in this phase
