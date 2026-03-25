# Requirements Document

## Introduction

This feature adds a repository selector menu to the Repository Metadata Dashboard. Currently, the dashboard only displays metadata for a repository after a new ingestion is triggered. The selector menu allows users to pick any previously ingested repository from a dropdown, loading its metadata without re-ingesting. This improves usability by giving quick access to all known repositories stored in the database.

## Glossary

- **Repository_Selector**: An Angular Material dropdown (`mat-select`) component that displays a list of repositories fetched from the backend API and allows the user to choose one.
- **Repository_Service**: The Angular service (`RepositoryService`) responsible for making HTTP calls to the backend API.
- **Repository_API**: The Express router (`/api/repositories`) that exposes repository data from the database.
- **Dashboard**: The main dashboard view (`DashboardComponent`) that displays repository metadata, languages, frameworks, and dependencies.
- **Repository**: A record in the database representing a code repository with an id, name, source type, and source identifier.

## Requirements

### Requirement 1: Fetch Repository List

**User Story:** As a user, I want the dashboard to fetch the list of all repositories from the backend, so that I can see which repositories are available for selection.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Repository_Service SHALL fetch the list of repositories from the Repository_API endpoint `GET /api/repositories`.
2. IF the Repository_API returns an error, THEN THE Dashboard SHALL display an error message indicating that the repository list failed to load.
3. WHILE the repository list is loading, THE Repository_Selector SHALL display a loading indicator or placeholder text to inform the user that data is being fetched.

### Requirement 2: Display Repository Selector Menu

**User Story:** As a user, I want a dropdown menu listing all available repositories, so that I can pick one to view its metadata.

#### Acceptance Criteria

1. THE Repository_Selector SHALL render as an Angular Material `mat-select` dropdown within the Dashboard toolbar or header area.
2. THE Repository_Selector SHALL display each repository's name as the option label.
3. THE Repository_Selector SHALL use each repository's id as the option value.
4. WHEN no repositories exist in the database, THE Repository_Selector SHALL display a disabled state with placeholder text "No repositories available".
5. THE Repository_Selector SHALL be accessible via keyboard navigation and comply with ARIA labeling for select controls.

### Requirement 3: Select a Repository

**User Story:** As a user, I want to select a repository from the dropdown, so that the dashboard loads and displays that repository's metadata.

#### Acceptance Criteria

1. WHEN the user selects a repository from the Repository_Selector, THE Dashboard SHALL fetch the full metadata for the selected repository from the Repository_API endpoint `GET /api/repositories/:id/metadata`.
2. WHEN the user selects a repository from the Repository_Selector, THE Dashboard SHALL update the displayed languages, frameworks, and dependencies panels with the selected repository's data.
3. WHILE metadata is loading after a selection, THE Dashboard SHALL show a loading state on the metadata panels.
4. IF the metadata fetch fails for the selected repository, THEN THE Dashboard SHALL display an error message and retain the previous selection in the Repository_Selector.

### Requirement 4: Reflect Ingestion Completion in Selector

**User Story:** As a user, I want the repository selector to update after I ingest a new repository, so that newly ingested repositories appear in the dropdown without a page refresh.

#### Acceptance Criteria

1. WHEN an ingestion completes successfully, THE Dashboard SHALL refresh the repository list in the Repository_Selector to include the newly ingested repository.
2. WHEN an ingestion completes successfully, THE Repository_Selector SHALL automatically select the newly ingested repository.

### Requirement 5: Repository Source Type Indicator

**User Story:** As a user, I want to see the source type of each repository in the selector, so that I can distinguish between local, GitHub, and Azure DevOps repositories.

#### Acceptance Criteria

1. THE Repository_Selector SHALL display a visual indicator (icon or label) next to each repository name showing the source type (local, github, or azure_devops).
2. THE Repository_Selector SHALL use distinct, recognizable icons or labels for each source type so that users can differentiate repositories at a glance.
