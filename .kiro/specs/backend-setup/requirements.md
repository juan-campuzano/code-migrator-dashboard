# Requirements Document

## Introduction

The Repository Metadata Dashboard backend is an Express/TypeScript application that ingests repository metadata from local filesystems, GitHub, and Azure DevOps. The codebase has well-structured adapters, parsers, scanners, services, and API routes, but lacks several pieces needed to run as a functional backend: automated database schema initialization, a repository listing endpoint, database connectivity validation, proper environment configuration, and a working health check that verifies downstream dependencies.

## Glossary

- **Backend**: The Express/TypeScript server application in the `backend/` directory
- **Database**: The PostgreSQL database used to persist repository metadata
- **Migration_Runner**: The component responsible for executing SQL migration files against the Database on startup
- **Health_Endpoint**: The `GET /health` API endpoint that reports Backend operational status
- **Repository_API**: The Express router mounted at `/api/repositories` serving repository metadata
- **Ingestion_Pipeline**: The end-to-end flow from source adapter fetch through scanner to database persistence, orchestrated by IngestionService
- **Token_Encryption_Key**: The 32-byte secret key used by TokenService to encrypt stored access tokens
- **Source_Adapter**: A component that fetches file trees and file contents from a repository source (local, GitHub, or Azure DevOps)

## Requirements

### Requirement 1: Database Schema Initialization

**User Story:** As a developer, I want the database schema to be automatically created when the backend starts, so that I do not need to manually run SQL scripts before using the application.

#### Acceptance Criteria

1. WHEN the Backend starts, THE Migration_Runner SHALL execute all pending SQL migration files from the `backend/src/db/migrations/` directory in filename-sorted order
2. THE Migration_Runner SHALL track which migrations have been applied using a `schema_migrations` table in the Database
3. WHEN a migration has already been applied, THE Migration_Runner SHALL skip that migration file
4. IF a migration file fails to execute, THEN THE Migration_Runner SHALL log the error and prevent the Backend from starting
5. WHEN all migrations complete successfully, THE Migration_Runner SHALL log the count of newly applied migrations

### Requirement 2: Database Connection Validation

**User Story:** As a developer, I want the backend to validate the database connection at startup, so that I get a clear error message if the database is unreachable.

#### Acceptance Criteria

1. WHEN the Backend starts, THE Backend SHALL attempt a test query against the Database before accepting HTTP requests
2. IF the Database is unreachable, THEN THE Backend SHALL log a descriptive error message including the configured host and port, and exit with a non-zero exit code
3. IF the Database connection succeeds, THEN THE Backend SHALL log a confirmation message indicating successful database connectivity

### Requirement 3: Repository Listing Endpoint

**User Story:** As a frontend developer, I want to retrieve a list of all ingested repositories, so that I can display them in the dashboard.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/repositories`, THE Repository_API SHALL return a JSON array of all repositories in the Database
2. THE Repository_API SHALL include for each repository: id, name, sourceType, sourceIdentifier, createdAt, and updatedAt fields
3. WHEN no repositories exist in the Database, THE Repository_API SHALL return an empty JSON array with HTTP status 200
4. IF a database error occurs during retrieval, THEN THE Repository_API SHALL return an HTTP 500 response with an ApiError object containing code "INTERNAL_ERROR"

### Requirement 4: Environment Configuration Validation

**User Story:** As a developer, I want the backend to validate required environment variables at startup, so that misconfiguration is caught early with clear error messages.

#### Acceptance Criteria

1. WHEN the Backend starts, THE Backend SHALL validate that either DATABASE_URL or the combination of PG_HOST, PG_DATABASE, and PG_USER environment variables are set
2. WHEN TOKEN_ENCRYPTION_KEY is provided, THE Backend SHALL validate that the Token_Encryption_Key is exactly 32 bytes (64 hex characters or valid base64)
3. IF a required environment variable is missing or invalid, THEN THE Backend SHALL log a descriptive error message naming the variable and exit with a non-zero exit code
4. WHEN TOKEN_ENCRYPTION_KEY is not provided, THE Backend SHALL log a warning that token management endpoints are disabled and continue startup

### Requirement 5: Health Check with Dependency Verification

**User Story:** As an operations engineer, I want the health endpoint to verify database connectivity, so that I can monitor whether the backend is fully operational.

#### Acceptance Criteria

1. WHEN a GET request is made to `/health`, THE Health_Endpoint SHALL execute a lightweight query against the Database to verify connectivity
2. WHEN the Database is reachable, THE Health_Endpoint SHALL return HTTP 200 with a JSON body containing `status: "ok"` and `database: "connected"`
3. IF the Database is unreachable during a health check, THEN THE Health_Endpoint SHALL return HTTP 503 with a JSON body containing `status: "degraded"` and `database: "disconnected"`

### Requirement 6: Ingestion Error Reporting

**User Story:** As a developer, I want ingestion failures to return structured error responses, so that I can diagnose issues with source adapters or parsing.

#### Acceptance Criteria

1. IF a Source_Adapter throws an authentication error during ingestion, THEN THE Ingestion_Pipeline SHALL return an HTTP 401 response with an ApiError containing the provider name
2. IF a Source_Adapter throws a rate-limit error during ingestion, THEN THE Ingestion_Pipeline SHALL return an HTTP 429 response with an ApiError containing the retryAfter value in seconds
3. IF a Source_Adapter throws a not-found error during ingestion, THEN THE Ingestion_Pipeline SHALL return an HTTP 404 response with an ApiError containing the provider name
4. IF an unexpected error occurs during ingestion, THEN THE Ingestion_Pipeline SHALL return an HTTP 500 response with an ApiError containing code "INTERNAL_ERROR"

### Requirement 7: CORS Configuration

**User Story:** As a frontend developer, I want the backend to support configurable CORS origins, so that the frontend can communicate with the backend during development and production.

#### Acceptance Criteria

1. WHEN the CORS_ORIGIN environment variable is set, THE Backend SHALL restrict CORS allowed origins to the specified value
2. WHEN the CORS_ORIGIN environment variable is not set, THE Backend SHALL allow all origins as a development default
3. THE Backend SHALL include appropriate CORS headers for preflight OPTIONS requests

### Requirement 8: Graceful Shutdown

**User Story:** As an operations engineer, I want the backend to shut down gracefully, so that in-flight requests complete and database connections are released.

#### Acceptance Criteria

1. WHEN the Backend receives a SIGTERM or SIGINT signal, THE Backend SHALL stop accepting new HTTP connections
2. WHEN the Backend is shutting down, THE Backend SHALL wait for in-flight requests to complete before closing the Database connection pool
3. WHEN the Database connection pool is closed, THE Backend SHALL exit with exit code 0
4. IF the graceful shutdown exceeds 30 seconds, THEN THE Backend SHALL force exit with exit code 1
