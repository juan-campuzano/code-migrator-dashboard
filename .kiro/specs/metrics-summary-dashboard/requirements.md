# Requirements Document

## Introduction

The Metrics Summary Dashboard provides a centralized view that aggregates and displays key metrics across all ingested repositories. Users can see at a glance the overall health of their repository portfolio through freshness grades, dependency counts, language distributions, and an aggregate score. This feature adds a new navigable page (accessible from the main dashboard) that summarizes data already collected by the ingestion and freshness scoring pipelines.

## Glossary

- **Summary_Dashboard**: The new Angular page that displays aggregated metrics for all repositories.
- **Metrics_API**: The backend REST endpoint that computes and returns aggregated metrics across all repositories.
- **Repository_Card**: A UI element within the Summary_Dashboard that displays a single repository's key metrics (grade, dependency count, language breakdown).
- **Portfolio_Score**: A single numeric score (0–100) representing the weighted average freshness across all repositories.
- **Portfolio_Grade**: A letter grade (A–E) derived from the Portfolio_Score using the same grading scale as individual repositories.
- **Dashboard_Component**: The existing Angular dashboard page that shows per-repository details.
- **RepositoryDb**: The server-side database access layer that queries repository, freshness, and dependency data.

## Requirements

### Requirement 1: Backend Aggregation Endpoint

**User Story:** As a developer, I want a single API endpoint that returns aggregated metrics for all repositories, so that the frontend can render a summary view without making many individual requests.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/metrics/summary`, THE Metrics_API SHALL return a JSON response containing: the total repository count, the Portfolio_Score, the Portfolio_Grade, a per-repository summary array, and a global language distribution.
2. WHEN no repositories exist in the database, THE Metrics_API SHALL return a response with zero total repositories, a Portfolio_Score of 100, a Portfolio_Grade of "A", an empty repository summary array, and an empty language distribution.
3. WHEN one or more repositories lack freshness scores, THE Metrics_API SHALL exclude those repositories from the Portfolio_Score calculation and mark them with a `freshnessStatus` of "pending" in the per-repository summary.
4. THE Metrics_API SHALL include for each repository in the summary array: the repository id, name, source type, freshness grade, freshness weighted average, total dependency count, production dependency count, development dependency count, primary language, and last ingestion date.
5. THE Metrics_API SHALL compute the global language distribution by aggregating file counts across all repositories and returning each language with its total file count and proportion of the whole.
6. IF the database query fails, THEN THE Metrics_API SHALL return a 500 status code with an error response containing code "INTERNAL_ERROR" and a descriptive message.

### Requirement 2: Portfolio Score Computation

**User Story:** As a developer, I want an overall portfolio health score, so that I can quickly assess the aggregate freshness of all my repositories.

#### Acceptance Criteria

1. THE Metrics_API SHALL compute the Portfolio_Score as the weighted average of all individual repository freshness weighted averages, where each repository's weight equals its total number of scored dependencies.
2. WHEN all repositories have zero scored dependencies, THE Metrics_API SHALL set the Portfolio_Score to 100.
3. THE Metrics_API SHALL derive the Portfolio_Grade from the Portfolio_Score using the same scale: A (90–100), B (70–89), C (50–69), D (30–49), E (0–29).

### Requirement 3: Summary Dashboard Navigation

**User Story:** As a user, I want to navigate to the metrics summary from the main dashboard, so that I can switch between the per-repository view and the portfolio overview.

#### Acceptance Criteria

1. THE Dashboard_Component SHALL display a navigation element (button or link) labeled "Metrics Overview" in the page header that routes to the Summary_Dashboard.
2. WHEN the user clicks the "Metrics Overview" navigation element, THE Dashboard_Component SHALL navigate to the `/metrics` route.
3. THE Summary_Dashboard SHALL display a navigation element labeled "Repository Dashboard" that routes back to the main dashboard at `/`.
4. THE Summary_Dashboard SHALL be accessible at the `/metrics` route via Angular lazy-loaded module routing.

### Requirement 4: Portfolio Score Display

**User Story:** As a user, I want to see the overall portfolio grade and score prominently, so that I can immediately understand the health of all my repositories.

#### Acceptance Criteria

1. THE Summary_Dashboard SHALL display the Portfolio_Grade as a large, color-coded letter (A=green, B=blue, C=yellow, D=orange, E=red).
2. THE Summary_Dashboard SHALL display the Portfolio_Score as a numeric value (rounded to one decimal place) next to the Portfolio_Grade.
3. THE Summary_Dashboard SHALL display the total number of repositories alongside the portfolio score.
4. WHILE the metrics data is loading, THE Summary_Dashboard SHALL display a loading indicator in place of the portfolio score section.

### Requirement 5: Repository Summary Table

**User Story:** As a user, I want to see all repositories listed with their key metrics, so that I can compare repository health at a glance.

#### Acceptance Criteria

1. THE Summary_Dashboard SHALL display a table listing all repositories with columns: name, source type, freshness grade, freshness score, total dependencies, primary language, and last ingestion date.
2. THE Summary_Dashboard SHALL color-code the freshness grade column using the same color mapping as the Portfolio_Grade (A=green, B=blue, C=yellow, D=orange, E=red).
3. WHEN a repository has no freshness scores, THE Summary_Dashboard SHALL display "Pending" in the grade and score columns for that repository.
4. WHEN the user clicks a repository row, THE Summary_Dashboard SHALL navigate to the main dashboard and auto-select that repository.
5. THE Summary_Dashboard SHALL sort the table by freshness score in ascending order by default, placing the lowest-scoring repositories at the top for visibility.

### Requirement 6: Language Distribution Chart

**User Story:** As a user, I want to see the overall language distribution across all repositories, so that I can understand the technology landscape of my portfolio.

#### Acceptance Criteria

1. THE Summary_Dashboard SHALL display a chart showing the aggregated language distribution across all repositories.
2. THE Summary_Dashboard SHALL show each language's name and its proportion as a percentage of total files.
3. WHEN no language data is available, THE Summary_Dashboard SHALL display a message "No language data available" in place of the chart.

### Requirement 7: Grade Distribution Summary

**User Story:** As a user, I want to see how many repositories fall into each grade category, so that I can understand the distribution of repository health.

#### Acceptance Criteria

1. THE Summary_Dashboard SHALL display a breakdown showing the count of repositories in each grade category (A, B, C, D, E, and Pending).
2. THE Summary_Dashboard SHALL color-code each grade category count using the same color mapping as the Portfolio_Grade.
3. WHEN a grade category has zero repositories, THE Summary_Dashboard SHALL display that category with a count of 0.

### Requirement 8: Error Handling

**User Story:** As a user, I want clear feedback when the summary data cannot be loaded, so that I understand the system state.

#### Acceptance Criteria

1. IF the Metrics_API request fails, THEN THE Summary_Dashboard SHALL display an error message "Failed to load metrics summary. Please try again." with a retry button.
2. WHEN the user clicks the retry button, THE Summary_Dashboard SHALL re-request the metrics summary from the Metrics_API.
3. IF the Metrics_API returns an empty repository list, THEN THE Summary_Dashboard SHALL display a message "No repositories found. Ingest a repository to get started." with a link to the main dashboard.
