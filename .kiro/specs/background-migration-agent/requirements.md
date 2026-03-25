# Requirements Document

## Introduction

The Background Migration Agent is an AI-powered system that automates dependency upgrades and framework/SDK updates for repositories tracked by the Repository Metadata Dashboard. It leverages AI providers (starting with GitHub Copilot, extensible to Claude and Gemini) to analyze outdated dependencies, generate the necessary code changes, create a branch on the GitHub repository, and open a Pull Request with an AI-generated summary. The system uses the existing freshness scoring data to identify which dependencies need upgrading and the existing migrations table to track AI migration jobs through their lifecycle. Custom agent instructions (stored as a markdown file or system prompt) guide the AI on how to perform specific upgrades.

## Glossary

- **Migration_Agent**: The service that orchestrates AI-powered dependency upgrades by coordinating between the AI_Provider, the GitHub repository, and the migration job lifecycle.
- **Migration_Job**: A record in the `migrations` table representing a single AI-driven upgrade task, tracking its lifecycle from `queued` through `running` to `completed` or `failed`.
- **AI_Provider**: An abstraction over AI code-generation services (GitHub Copilot, Claude, Gemini) that accepts upgrade instructions and produces code changes.
- **Agent_Instructions**: A markdown file or system prompt that guides the AI_Provider on how to perform dependency upgrades, including coding conventions, testing requirements, and upgrade strategies specific to the repository.
- **Upgrade_Target**: A specific dependency or framework identified for upgrade, including its current version, target version, and ecosystem.
- **Migration_API**: The REST API endpoints for triggering, listing, and monitoring AI migration jobs.
- **Migration_Branch**: A Git branch created on the GitHub repository to contain the AI-generated code changes for an upgrade.
- **Migration_PR**: A Pull Request opened on the GitHub repository containing the AI-generated code changes and an AI-generated description summarizing the upgrade.
- **Dashboard**: The web frontend of the Repository Metadata Dashboard where users view repository health, freshness scores, and migration status.

## Requirements

### Requirement 1: Trigger AI Migration Jobs

**User Story:** As a developer, I want to trigger AI-powered dependency upgrades from the dashboard or API, so that I can initiate automated code changes for outdated dependencies.

#### Acceptance Criteria

1. THE Migration_API SHALL expose a `POST /api/migrations` endpoint that accepts a `repositoryId`, a `migrationType` of `ai-upgrade`, and a `parameters` object specifying the Upgrade_Targets.
2. WHEN a migration request specifies individual dependencies, THE Migration_API SHALL accept a `parameters.dependencies` array containing dependency names and optional target versions.
3. WHEN a migration request specifies `parameters.upgradeAll` as `true`, THE Migration_Agent SHALL use the repository's freshness scoring data to identify all dependencies with a freshness score below a configurable threshold (defaulting to 0.8).
4. WHEN a valid migration request is received, THE Migration_API SHALL create a Migration_Job with status `queued` and return the job ID to the caller.
5. IF the specified repository does not exist, THEN THE Migration_API SHALL return a 404 response with a descriptive error message.
6. IF the specified repository has no completed ingestion, THEN THE Migration_API SHALL return a 422 response indicating that dependency data is not yet available.
7. IF the specified repository is not a GitHub repository, THEN THE Migration_API SHALL return a 422 response indicating that AI migrations are only supported for GitHub repositories.

### Requirement 2: AI Provider Integration

**User Story:** As a developer, I want the system to use AI providers to generate code changes for dependency upgrades, so that upgrades are performed intelligently with minimal manual effort.

#### Acceptance Criteria

1. THE Migration_Agent SHALL define an AI_Provider interface with methods for generating code changes given a set of Upgrade_Targets and Agent_Instructions.
2. THE Migration_Agent SHALL include a GitHub Copilot implementation of the AI_Provider interface as the default provider.
3. THE AI_Provider interface SHALL accept the repository context (file tree, dependency manifest contents, current versions) and the Upgrade_Targets as input.
4. THE AI_Provider interface SHALL return a set of file changes (file path, original content, modified content) as output.
5. IF the AI_Provider fails to generate changes for a specific dependency, THEN THE Migration_Agent SHALL record the failure details in the Migration_Job's `error_details` field and continue processing remaining dependencies.
6. THE AI_Provider integration SHALL be configurable via environment variables for API keys and endpoint URLs (`AI_PROVIDER_TYPE`, `AI_PROVIDER_API_KEY`, `AI_PROVIDER_ENDPOINT`).

### Requirement 3: Custom Agent Instructions

**User Story:** As a developer, I want to provide custom instructions that guide the AI on how to perform upgrades for my repository, so that generated changes follow my project's conventions and requirements.

#### Acceptance Criteria

1. THE Migration_Agent SHALL look for a `.migration-agent.md` file in the root of the GitHub repository to use as Agent_Instructions.
2. WHEN a `.migration-agent.md` file is found, THE Migration_Agent SHALL include its contents as part of the system prompt sent to the AI_Provider.
3. IF no `.migration-agent.md` file is found in the repository, THEN THE Migration_Agent SHALL use a built-in default set of Agent_Instructions that covers common upgrade patterns.
4. THE Agent_Instructions SHALL support specifying: coding conventions, test requirements, files or directories to exclude from changes, and upgrade strategy preferences (conservative vs. aggressive).
5. THE Migration_API SHALL accept an optional `parameters.customInstructions` string that overrides the repository-level Agent_Instructions for a single Migration_Job.

### Requirement 4: Branch Creation and Pull Request Workflow

**User Story:** As a developer, I want the migration agent to create a branch and open a Pull Request with the upgrade changes, so that I can review and merge the AI-generated code through my normal workflow.

#### Acceptance Criteria

1. WHEN a Migration_Job begins processing, THE Migration_Agent SHALL create a Migration_Branch on the GitHub repository with a descriptive name following the pattern `migration-agent/<migration-id>-<short-description>`.
2. THE Migration_Agent SHALL commit the AI-generated file changes to the Migration_Branch with a descriptive commit message summarizing the upgrade.
3. WHEN all file changes are committed, THE Migration_Agent SHALL open a Migration_PR from the Migration_Branch to the repository's default branch.
4. THE Migration_Agent SHALL use the GitHub access token stored in the `access_tokens` table (via the existing TokenService) to authenticate all GitHub API operations.
5. IF the Migration_Branch cannot be created (due to permissions or conflicts), THEN THE Migration_Agent SHALL mark the Migration_Job as `failed` with a descriptive error message.
6. IF the Migration_PR cannot be opened, THEN THE Migration_Agent SHALL mark the Migration_Job as `failed` with a descriptive error message, and the Migration_Branch SHALL remain for manual inspection.

### Requirement 5: AI-Generated Pull Request Description

**User Story:** As a developer, I want the Pull Request to include an AI-generated summary of changes, so that I can quickly understand what was upgraded and why.

#### Acceptance Criteria

1. THE Migration_Agent SHALL generate a Migration_PR description that includes: a summary of which dependencies were upgraded, the version changes (from → to), and a brief explanation of breaking changes or notable migration steps.
2. THE Migration_PR description SHALL include a list of all files modified by the upgrade.
3. THE Migration_PR description SHALL include a link back to the Migration_Job in the Dashboard (using a configurable base URL).
4. THE AI_Provider SHALL generate the PR description content based on the code changes it produced and the dependency metadata.
5. IF the AI_Provider cannot generate a description, THEN THE Migration_Agent SHALL use a fallback template that lists the dependency version changes without AI-generated explanations.

### Requirement 6: Migration Job Lifecycle and Tracking

**User Story:** As a developer, I want to track the progress and outcome of AI migration jobs, so that I can monitor upgrades and troubleshoot failures.

#### Acceptance Criteria

1. THE Migration_Job SHALL follow the existing status lifecycle: `queued` → `running` → `completed` or `failed`.
2. WHEN a Migration_Job transitions to `running`, THE Migration_Agent SHALL record the start timestamp in `updated_at`.
3. WHEN a Migration_Job completes successfully, THE Migration_Agent SHALL store the Migration_PR URL in the `result` field and set status to `completed`.
4. WHEN a Migration_Job fails, THE Migration_Agent SHALL store a descriptive error message in `error_details` and set status to `failed`.
5. THE Migration_API SHALL expose a `GET /api/migrations` endpoint that returns Migration_Jobs with optional filtering by `repositoryId` and `status`, ordered by `created_at` descending.
6. THE Migration_API SHALL expose a `GET /api/migrations/:id` endpoint that returns the full details of a single Migration_Job.
7. THE Migration_API SHALL expose a `POST /api/migrations/:id/cancel` endpoint that transitions a `queued` Migration_Job to `failed` with `error_details` set to "Cancelled by user".
8. IF a cancel request targets a Migration_Job not in `queued` status, THEN THE Migration_API SHALL return a 409 response.
9. IF a cancel request targets a non-existent Migration_Job, THEN THE Migration_API SHALL return a 404 response.

### Requirement 7: Dashboard Integration

**User Story:** As a developer, I want to see migration status and PR links in the dashboard, so that I can manage AI upgrades alongside my repository health data.

#### Acceptance Criteria

1. THE Dashboard SHALL display a list of Migration_Jobs for each repository, showing status, migration type, creation time, and a link to the Migration_PR when available.
2. THE Dashboard SHALL allow triggering a new AI migration from the repository detail view, with options to select specific outdated dependencies or upgrade all.
3. WHEN a Migration_Job has status `completed`, THE Dashboard SHALL display a clickable link to the Migration_PR on GitHub.
4. WHEN a Migration_Job has status `failed`, THE Dashboard SHALL display the error details from the `error_details` field.
5. THE Dashboard SHALL allow cancelling a `queued` Migration_Job.

### Requirement 8: Error Handling and Recovery

**User Story:** As a developer, I want the migration agent to handle errors gracefully, so that failures in one upgrade do not block other migrations or corrupt repository state.

#### Acceptance Criteria

1. IF the AI_Provider returns an error or times out, THEN THE Migration_Agent SHALL mark the Migration_Job as `failed` with the error details and proceed to process the next queued job.
2. IF the GitHub API returns a rate limit error, THEN THE Migration_Agent SHALL mark the Migration_Job as `failed` with an error message including the retry-after duration.
3. IF the GitHub access token is missing or invalid, THEN THE Migration_Agent SHALL mark the Migration_Job as `failed` with an error message indicating the authentication issue.
4. IF the Migration_Agent encounters an unexpected error during job processing, THEN THE Migration_Agent SHALL log the error, mark the job as `failed`, and continue processing the queue.
5. THE Migration_Agent SHALL process one Migration_Job at a time to maintain predictable resource usage and avoid concurrent branch conflicts.
6. WHEN the server shuts down, THE Migration_Agent SHALL stop accepting new jobs and wait for any in-progress job to complete within a configurable timeout (defaulting to 60 seconds).
7. IF the in-progress job does not complete within the shutdown timeout, THEN THE Migration_Agent SHALL log a warning and leave the job in `running` status for manual resolution.
