# Requirements Document

## Introduction

The Dependency Freshness Scoring feature evaluates how up-to-date a repository's dependencies are by comparing the currently declared version constraints against the latest available versions from their respective package registries. Each dependency receives a freshness score, and these scores are aggregated into an overall repository-level grade from A (most current) to E (most outdated). This gives teams a quick, actionable view of their dependency health.

## Glossary

- **Freshness_Scorer**: The server-side component that computes freshness scores for individual dependencies and aggregates them into a repository-level grade.
- **Registry_Client**: The server-side component responsible for fetching the latest available version of a dependency from its ecosystem's package registry (e.g., npm, PyPI, crates.io, Maven Central, RubyGems, pkg.go.dev, Gradle Plugin Portal).
- **Version_Constraint**: The version string declared in a manifest file (e.g., `^1.2.3`, `~=3.4`, `>=1.0,<2.0`). Already captured by existing parsers as `versionConstraint`.
- **Resolved_Version**: The concrete version number extracted or inferred from a Version_Constraint (e.g., `^1.2.3` resolves to a minimum of `1.2.3`).
- **Latest_Version**: The most recent stable release version of a dependency as reported by its package registry.
- **Dependency_Freshness_Score**: A numeric score between 0 and 100 assigned to a single dependency, representing how close the Resolved_Version is to the Latest_Version.
- **Repository_Grade**: A letter grade from A to E assigned to a repository, derived by aggregating all Dependency_Freshness_Scores for that repository.
- **Ecosystem**: The package manager ecosystem a dependency belongs to (e.g., `npm`, `pypi`, `cargo`, `maven`, `rubygems`, `go`, `gradle`). Already defined in the existing `Dependency` model.
- **Scoring_API**: The REST API endpoint that exposes freshness scores and grades for a repository.
- **Dashboard**: The Angular 17 frontend that displays freshness scores and grades to the user.

## Requirements

### Requirement 1: Fetch Latest Versions from Package Registries

**User Story:** As a developer, I want the system to look up the latest version of each dependency from its package registry, so that I can compare my current versions against what is available.

#### Acceptance Criteria

1. WHEN an ingestion completes for a repository, THE Registry_Client SHALL fetch the Latest_Version for each dependency from the corresponding package registry.
2. THE Registry_Client SHALL support fetching Latest_Versions from the following registries: npm, PyPI, crates.io, Maven Central, RubyGems, and pkg.go.dev.
3. WHILE fetching Latest_Versions, THE Registry_Client SHALL process requests concurrently with a configurable concurrency limit to avoid overwhelming registries.
4. IF a package registry returns an error or is unreachable, THEN THE Registry_Client SHALL record the error for that dependency and continue processing remaining dependencies.
5. IF a dependency is not found in its package registry, THEN THE Registry_Client SHALL mark that dependency as "unresolved" and exclude it from score calculations.
6. THE Registry_Client SHALL cache fetched Latest_Versions with a configurable time-to-live (TTL) to reduce redundant registry lookups.

### Requirement 2: Resolve Concrete Versions from Version Constraints

**User Story:** As a developer, I want the system to extract a concrete version number from my declared version constraints, so that a meaningful comparison can be made against the latest version.

#### Acceptance Criteria

1. WHEN a Version_Constraint is provided, THE Freshness_Scorer SHALL extract the Resolved_Version representing the minimum satisfying version.
2. THE Freshness_Scorer SHALL support version constraint syntaxes for: npm/Node.js (semver ranges), Python (PEP 440), Rust/Cargo (Cargo semver), Maven (Maven version ranges), Ruby (RubyGems pessimistic constraints), and Go (module pseudo-versions and semver).
3. IF a Version_Constraint is empty or absent, THEN THE Freshness_Scorer SHALL treat the dependency as "unpinned" and assign it a Dependency_Freshness_Score of 0.
4. IF a Version_Constraint cannot be parsed, THEN THE Freshness_Scorer SHALL record a warning and exclude that dependency from score calculations.

### Requirement 3: Compute Individual Dependency Freshness Scores

**User Story:** As a developer, I want each dependency to receive a numeric freshness score, so that I can see at a glance which dependencies are outdated.

#### Acceptance Criteria

1. WHEN a Resolved_Version and a Latest_Version are both available for a dependency, THE Freshness_Scorer SHALL compute a Dependency_Freshness_Score between 0 and 100.
2. THE Freshness_Scorer SHALL assign a score of 100 WHEN the Resolved_Version major, minor, and patch components match the Latest_Version.
3. THE Freshness_Scorer SHALL reduce the score based on the number of major, minor, and patch versions behind, weighting major version differences more heavily than minor, and minor more heavily than patch.
4. THE Freshness_Scorer SHALL assign a score of 0 WHEN the Resolved_Version is more than 3 major versions behind the Latest_Version.
5. THE Freshness_Scorer SHALL treat pre-release versions (e.g., `1.0.0-alpha`) as older than their corresponding release versions during comparison.

### Requirement 4: Aggregate Scores into a Repository Grade

**User Story:** As a team lead, I want a single letter grade for the entire repository, so that I can quickly assess overall dependency health.

#### Acceptance Criteria

1. WHEN all Dependency_Freshness_Scores for a repository have been computed, THE Freshness_Scorer SHALL calculate a weighted average score, weighting production dependencies more heavily than development dependencies.
2. THE Freshness_Scorer SHALL map the weighted average score to a Repository_Grade using the following thresholds: A (90-100), B (70-89), C (50-69), D (30-49), E (0-29).
3. THE Freshness_Scorer SHALL assign a grade of A WHEN a repository has zero dependencies.
4. FOR ALL valid sets of Dependency_Freshness_Scores, computing the Repository_Grade and then verifying the grade falls within the correct threshold range SHALL produce a consistent result (round-trip property).

### Requirement 5: Persist Freshness Scores

**User Story:** As a developer, I want freshness scores to be stored in the database, so that I can view historical data and avoid recomputing scores on every request.

#### Acceptance Criteria

1. WHEN freshness scores are computed for a repository, THE Freshness_Scorer SHALL persist each Dependency_Freshness_Score, the associated Latest_Version, and the computed Repository_Grade to the database.
2. THE Freshness_Scorer SHALL associate stored scores with the ingestion record that triggered the computation.
3. WHEN a new ingestion completes, THE Freshness_Scorer SHALL replace previously stored scores for that repository with the newly computed scores.
4. THE Freshness_Scorer SHALL store a timestamp indicating when the scores were last computed.

### Requirement 6: Expose Freshness Scores via REST API

**User Story:** As a frontend developer, I want API endpoints to retrieve freshness scores and grades, so that I can display them in the dashboard.

#### Acceptance Criteria

1. THE Scoring_API SHALL expose a `GET /api/repositories/:id/freshness` endpoint that returns the Repository_Grade, the weighted average score, the score computation timestamp, and a per-dependency breakdown.
2. THE Scoring_API SHALL include for each dependency: the dependency name, ecosystem, Resolved_Version, Latest_Version, Dependency_Freshness_Score, and dependency type (production or development).
3. IF the repository has no computed freshness scores, THEN THE Scoring_API SHALL return a 404 response with a descriptive error message.
4. IF the repository ID does not exist, THEN THE Scoring_API SHALL return a 404 response with a descriptive error message.
5. THE Scoring_API SHALL support an optional `ecosystem` query parameter to filter the per-dependency breakdown by ecosystem.

### Requirement 7: Display Freshness Scores in the Dashboard

**User Story:** As a developer, I want to see the freshness grade and per-dependency scores in the web dashboard, so that I can identify outdated dependencies visually.

#### Acceptance Criteria

1. WHEN a user navigates to a repository detail page, THE Dashboard SHALL display the Repository_Grade prominently with a color indicator (A=green, B=light-green, C=yellow, D=orange, E=red).
2. THE Dashboard SHALL display the weighted average score as a numeric percentage alongside the grade.
3. THE Dashboard SHALL display a table of dependencies showing: name, ecosystem, current version, latest version, individual score, and dependency type.
4. THE Dashboard SHALL allow the user to sort the dependency table by score, name, or ecosystem.
5. THE Dashboard SHALL allow the user to filter the dependency table by ecosystem using a dropdown.
6. WHILE freshness scores are being loaded, THE Dashboard SHALL display a loading indicator.
7. IF no freshness scores are available for a repository, THEN THE Dashboard SHALL display a message indicating that scores have not been computed yet.

### Requirement 8: Trigger Freshness Scoring

**User Story:** As a developer, I want freshness scoring to run automatically after ingestion and on demand, so that scores stay current.

#### Acceptance Criteria

1. WHEN an ingestion completes successfully, THE Freshness_Scorer SHALL automatically compute freshness scores for the ingested repository.
2. THE Scoring_API SHALL expose a `POST /api/repositories/:id/freshness/refresh` endpoint that triggers a fresh score computation without requiring a full re-ingestion.
3. IF a scoring computation is already in progress for the repository, THEN THE Scoring_API SHALL return a 409 response indicating a conflict.
4. IF the repository has no completed ingestion, THEN THE Scoring_API SHALL return a 400 response with a descriptive error message.
