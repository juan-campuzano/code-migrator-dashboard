# Requirements Document

## Introduction

The Repository Metadata Dashboard is a feature that provides developers with a consolidated view of a repository's technical metadata. It uses an ingestion-based architecture where a backend service fetches repository contents from local filesystems, GitHub API, or Azure DevOps API, parses and extracts metadata (languages, frameworks, versions, dependencies), and stores all extracted data in a PostgreSQL database with JSONB support for flexible data structures. The dashboard frontend reads from this database to display metadata. This ingestion-into-database approach is designed to enable future bulk migration capabilities — searching for patterns, dependencies, and technology usage across multiple repositories. The dashboard is the first phase; bulk migration operations via a background agent will follow.

## Glossary

- **Dashboard**: The main user interface that displays repository metadata by reading from the Repository_Database
- **Repository_Scanner**: The component responsible for analyzing a repository's files to extract metadata as part of the ingestion pipeline
- **Repository_Ingestion**: The process of fetching repository contents from a Repository_Source, extracting metadata via the Repository_Scanner, and persisting all results to the Repository_Database
- **Ingestion_Service**: The backend service that orchestrates Repository_Ingestion, managing the lifecycle of fetching, scanning, and storing repository data
- **Repository_Database**: The PostgreSQL database that stores all ingested repository metadata, file tree structures, and ingestion status records
- **Metadata**: Structured information about a repository including languages, frameworks, versions, and dependencies
- **Technology**: A programming language or framework detected in the repository
- **Dependency**: A third-party library or package that the repository depends on, as declared in manifest files
- **Manifest_File**: A file that declares project dependencies and metadata (e.g., package.json, pom.xml, requirements.txt, Gemfile, go.mod, Cargo.toml)
- **Technology_Stack**: The combined set of languages, frameworks, and their versions used in a repository
- **Repository_Source**: The origin from which repository data is accessed; one of Local_Filesystem, GitHub_API, or Azure_DevOps_API
- **Local_Filesystem**: A repository source where the repository is accessed directly from a local file path on the user's machine
- **GitHub_API**: The GitHub REST API (https://api.github.com) used to access repository contents, metadata, and files from GitHub-hosted repositories
- **Azure_DevOps_API**: The Azure DevOps REST API used to access repository contents, metadata, and files from Azure DevOps-hosted repositories
- **Repository_URL**: A URL identifying a remote repository on GitHub (e.g., https://github.com/owner/repo) or Azure DevOps (e.g., https://dev.azure.com/org/project/_git/repo)
- **Access_Token**: A personal access token (PAT) or OAuth token used to authenticate API requests to GitHub_API or Azure_DevOps_API
- **Rate_Limit**: A restriction imposed by a remote API on the number of requests allowed within a time window
- **Ingestion_Status**: The current state of a Repository_Ingestion operation; one of pending, in_progress, completed, or failed

## Requirements

### Requirement 1: Repository Ingestion

**User Story:** As a developer, I want repository contents to be ingested into a database, so that metadata is persisted and available for dashboard display and future bulk migration queries.

#### Acceptance Criteria

1. WHEN a Repository_Ingestion is triggered for a Repository_Source, THE Ingestion_Service SHALL fetch the repository contents and store all extracted Metadata in the Repository_Database.
2. THE Ingestion_Service SHALL store extracted metadata in structured PostgreSQL tables covering languages, frameworks, dependencies, and version information.
3. THE Ingestion_Service SHALL store the file tree structure of the ingested repository in the Repository_Database to enable future pattern searching.
4. WHEN a user manually triggers an ingestion, THE Ingestion_Service SHALL begin the Repository_Ingestion process for the specified Repository_Source.
5. WHERE scheduled ingestion is configured, THE Ingestion_Service SHALL automatically trigger Repository_Ingestion at the configured interval.
6. WHILE a Repository_Ingestion is in progress, THE Ingestion_Service SHALL maintain an Ingestion_Status of in_progress for that repository in the Repository_Database.
7. WHEN a Repository_Ingestion completes successfully, THE Ingestion_Service SHALL set the Ingestion_Status to completed and record the completion timestamp.
8. IF a Repository_Ingestion fails, THEN THE Ingestion_Service SHALL set the Ingestion_Status to failed and record the error details in the Repository_Database.
9. WHEN a repository that has been previously ingested is ingested again, THE Ingestion_Service SHALL update the existing records in the Repository_Database rather than creating duplicate entries.
10. THE Ingestion_Service SHALL use PostgreSQL JSONB columns for storing flexible or schema-variable metadata that may differ across repository types.

### Requirement 2: Repository Scanning

**User Story:** As a developer, I want the ingestion pipeline to scan repository files and extract technology metadata, so that the database contains accurate information about languages, frameworks, and versions.

#### Acceptance Criteria

1. WHEN a Repository_Ingestion is in progress for a local filesystem path, THE Repository_Scanner SHALL analyze the local repository and identify all programming languages used based on file extensions and file content.
2. WHEN a Repository_Ingestion is in progress for a GitHub Repository_URL, THE Repository_Scanner SHALL use the GitHub_API to retrieve repository contents and identify all programming languages used.
3. WHEN a Repository_Ingestion is in progress for an Azure DevOps Repository_URL, THE Repository_Scanner SHALL use the Azure_DevOps_API to retrieve repository contents and identify all programming languages used.
4. WHEN a Repository_Source is provided, THE Repository_Scanner SHALL detect frameworks by inspecting Manifest_Files and configuration files present in the repository.
5. WHEN a repository is scanned, THE Repository_Scanner SHALL extract version information for each detected Technology from Manifest_Files and lock files where available.
6. THE Repository_Scanner SHALL pass all extracted metadata to the Ingestion_Service for persistence in the Repository_Database.
7. IF a local repository path is invalid or inaccessible, THEN THE Repository_Scanner SHALL return a descriptive error message indicating the cause of the failure.
8. IF a Repository_URL does not match a supported remote provider (GitHub or Azure DevOps), THEN THE Repository_Scanner SHALL return an error message listing the supported providers.
9. IF no Manifest_Files are found in the repository, THEN THE Repository_Scanner SHALL still report detected languages based on file extensions and indicate that no dependency information is available.

### Requirement 3: Dependency Extraction

**User Story:** As a developer, I want to see all dependencies declared in the repository, so that I can review what third-party libraries the project relies on.

#### Acceptance Criteria

1. WHEN a repository contains Manifest_Files, THE Repository_Scanner SHALL extract all declared dependencies including their names and version constraints.
2. WHEN a repository contains multiple Manifest_Files, THE Repository_Scanner SHALL extract dependencies from each Manifest_File and associate them with the corresponding package ecosystem (e.g., npm, Maven, pip, cargo).
3. THE Repository_Scanner SHALL distinguish between production dependencies and development dependencies where the Manifest_File format supports this distinction.
4. WHEN a Manifest_File contains a malformed entry, THE Repository_Scanner SHALL skip the malformed entry, log a warning, and continue processing the remaining entries.

### Requirement 4: Dashboard Display

**User Story:** As a developer, I want to view the repository metadata in a clear, organized dashboard, so that I can quickly understand the repository's technology landscape.

#### Acceptance Criteria

1. THE Dashboard SHALL read all displayed metadata from the Repository_Database.
2. THE Dashboard SHALL display a summary section showing all detected programming languages and their relative usage proportion in the repository.
3. THE Dashboard SHALL display a frameworks section listing each detected framework alongside its version.
4. THE Dashboard SHALL display a dependencies section listing all extracted dependencies grouped by their package ecosystem.
5. WHEN a dependency has a version constraint, THE Dashboard SHALL display the version constraint alongside the dependency name.
6. THE Dashboard SHALL display the total count of dependencies per package ecosystem.
7. THE Dashboard SHALL display the current Ingestion_Status and last successful ingestion timestamp for the repository.
8. WHEN no metadata is available for a section, THE Dashboard SHALL display an informative empty state message for that section.

### Requirement 5: Supported Manifest File Formats

**User Story:** As a developer working across different technology stacks, I want the dashboard to support common manifest file formats, so that it works with the repositories I maintain.

#### Acceptance Criteria

1. THE Repository_Scanner SHALL support parsing package.json files for Node.js/JavaScript dependencies.
2. THE Repository_Scanner SHALL support parsing requirements.txt and pyproject.toml files for Python dependencies.
3. THE Repository_Scanner SHALL support parsing pom.xml and build.gradle files for Java dependencies.
4. THE Repository_Scanner SHALL support parsing Cargo.toml files for Rust dependencies.
5. THE Repository_Scanner SHALL support parsing go.mod files for Go dependencies.
6. THE Repository_Scanner SHALL support parsing Gemfile files for Ruby dependencies.
7. FOR ALL supported Manifest_File formats, parsing a valid Manifest_File then serializing the extracted data then parsing the serialized data SHALL produce an equivalent dependency list (round-trip property).

### Requirement 6: Dashboard Refresh

**User Story:** As a developer, I want to refresh the dashboard data, so that I can see up-to-date metadata after making changes to the repository.

#### Acceptance Criteria

1. WHEN the user triggers a refresh action, THE Dashboard SHALL initiate a new Repository_Ingestion for the repository and update all displayed metadata from the Repository_Database upon completion.
2. WHILE a Repository_Ingestion triggered by a refresh is in progress, THE Dashboard SHALL display a loading indicator to inform the user that data is being refreshed.
3. IF a refresh-triggered Repository_Ingestion fails, THEN THE Dashboard SHALL retain the previously displayed data and show an error notification describing the failure.

### Requirement 7: Error Handling and Resilience

**User Story:** As a developer, I want the dashboard to handle errors gracefully, so that a problem with one part of the scan does not prevent me from seeing the rest of the metadata.

#### Acceptance Criteria

1. IF an error occurs while parsing a single Manifest_File, THEN THE Repository_Scanner SHALL continue scanning remaining files and report the error alongside the successful results.
2. IF the repository contains files with unrecognized extensions, THEN THE Repository_Scanner SHALL skip those files without producing an error.
3. WHEN scan results are displayed, THE Dashboard SHALL indicate which sections completed successfully and which encountered errors.

### Requirement 8: Remote Repository Access

**User Story:** As a developer, I want to provide a GitHub or Azure DevOps repository URL instead of a local path, so that I can ingest and view the technology stack of repositories I have not cloned locally.

#### Acceptance Criteria

1. WHEN a user provides a Repository_URL, THE Ingestion_Service SHALL determine the Repository_Source type (GitHub_API or Azure_DevOps_API) based on the URL format.
2. WHEN a GitHub Repository_URL is provided, THE Ingestion_Service SHALL authenticate with the GitHub_API using a configured Access_Token (personal access token or OAuth token).
3. WHEN an Azure DevOps Repository_URL is provided, THE Ingestion_Service SHALL authenticate with the Azure_DevOps_API using a configured Access_Token (personal access token or OAuth token).
4. THE Dashboard SHALL provide a configuration mechanism for the user to supply and store Access_Tokens for GitHub_API and Azure_DevOps_API.
5. IF an Access_Token is missing or not configured for the target remote provider, THEN THE Ingestion_Service SHALL return an error message prompting the user to configure authentication for that provider.
6. IF an Access_Token is invalid or expired, THEN THE Ingestion_Service SHALL return a descriptive authentication error and prompt the user to update the Access_Token.
7. IF a network request to a remote API fails due to a connectivity issue, THEN THE Ingestion_Service SHALL return an error message indicating the network failure and suggest the user verify connectivity.
8. IF a remote API returns a Rate_Limit error, THEN THE Ingestion_Service SHALL return an error message indicating the rate limit has been exceeded and include the time until the limit resets when provided by the API.
9. IF a remote API returns a 404 or equivalent not-found response, THEN THE Ingestion_Service SHALL return an error message indicating the repository was not found or the Access_Token lacks permission to access the repository.
10. WHEN accessing a remote repository, THE Ingestion_Service SHALL retrieve only the files necessary for scanning (Manifest_Files, configuration files, and file tree metadata) to minimize API usage.