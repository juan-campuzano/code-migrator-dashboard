# Requirements Document

## Introduction

The Repository Metadata Dashboard currently renders all components in a flat, unstyled single-column layout with no visual hierarchy, no responsive behavior, and no CSS styling. This feature improves the dashboard's user-friendliness by introducing Angular Material 3 (M3) components and theming to provide a structured layout, consistent visual styling, responsive design, loading and empty state indicators, and interaction feedback across all dashboard components.

## Glossary

- **Dashboard**: The main page of the Repository Metadata Dashboard application, composed of multiple panels displaying repository metadata.
- **Ingestion_Form**: The form component where users enter a repository path or URL to trigger metadata ingestion.
- **Ingestion_Status_Panel**: The component that displays the current status of an ongoing or completed ingestion operation.
- **Error_Banner**: The component that displays scan errors returned from the backend.
- **Language_Summary**: The component that displays a bar chart of detected programming languages and their proportions.
- **Framework_List**: The component that displays a table of detected frameworks and their versions.
- **Dependency_Panel**: The component that displays dependencies grouped by ecosystem with collapsible sections.
- **Token_Settings**: The component where users configure access tokens for GitHub and Azure DevOps.
- **Migration_Trigger**: The component where users trigger and monitor framework or dependency migrations.
- **Mat_Card**: An Angular Material card component (mat-card) used as a visually distinct container with elevation, border-radius, and optional header to group related content.
- **Mat_Progress_Bar**: An Angular Material progress bar component (mat-progress-bar) displayed to indicate loading or in-progress operations.
- **Mat_Snack_Bar**: An Angular Material snack-bar service (MatSnackBar) used to display brief, auto-dismissing messages confirming the result of a user action.
- **Mat_Table**: An Angular Material table component (mat-table) used to render structured data with built-in sorting, styling, and accessibility.
- **Mat_Form_Field**: An Angular Material form field wrapper (mat-form-field) that provides floating labels, error messages, and consistent input styling.
- **Mat_Button**: An Angular Material button directive (mat-raised-button, mat-flat-button, mat-stroked-button) providing M3-themed interactive buttons.
- **Mat_Expansion_Panel**: An Angular Material expansion panel component (mat-expansion-panel) used for collapsible content sections.
- **Mat_Toolbar**: An Angular Material toolbar component (mat-toolbar) used for the page header.
- **Mat_Icon**: An Angular Material icon component (mat-icon) used to render Material Symbols icons.
- **M3_Theme**: A custom Angular Material 3 theme defined using the mat.defineTheme API with a primary color palette, providing consistent color tokens across all components.
- **Skeleton_Loader**: A placeholder animation displayed while content is being fetched from the backend, implemented using mat-progress-bar in indeterminate mode or CSS shimmer within Mat_Card containers.

## Requirements

### Requirement 1: Angular Material 3 Setup and Theming

**User Story:** As a developer, I want the application to use Angular Material with M3 theming, so that all components share a consistent, modern design system.

#### Acceptance Criteria

1. THE Dashboard SHALL include @angular/material as a project dependency.
2. THE Dashboard SHALL define an M3_Theme using the mat.defineTheme API with a primary palette based on a blue seed color.
3. THE Dashboard SHALL apply the M3_Theme globally so that all Angular Material components inherit theme colors, typography, and density settings.
4. THE Dashboard SHALL use Angular Material typography hierarchy (mat-headline, mat-body, mat-caption levels) for all text content.
5. THE Dashboard SHALL include the Material Symbols icon font for use with Mat_Icon components.

### Requirement 2: Dashboard Layout and Visual Hierarchy

**User Story:** As a user, I want the dashboard to have a clear visual structure, so that I can quickly locate and understand different sections of repository metadata.

#### Acceptance Criteria

1. THE Dashboard SHALL render each major section (Ingestion_Form, Ingestion_Status_Panel, Error_Banner, Language_Summary, Framework_List, Dependency_Panel, Token_Settings, Migration_Trigger) inside a Mat_Card container.
2. THE Dashboard SHALL display a Mat_Toolbar as the page header containing the application title "Repository Metadata Dashboard".
3. THE Dashboard SHALL apply consistent spacing of 16px between Mat_Card containers using CSS gap or margin.
4. THE Dashboard SHALL arrange the Language_Summary and Framework_List Mat_Card containers side by side on viewports wider than 768px using CSS grid or flexbox.
5. WHILE the viewport width is 768px or narrower, THE Dashboard SHALL stack all Mat_Card containers in a single column layout.

### Requirement 3: Global Styling with M3 Theme Tokens

**User Story:** As a user, I want the application to have a cohesive visual appearance, so that the interface feels polished and professional.

#### Acceptance Criteria

1. THE Dashboard SHALL use the M3_Theme surface color token for the page body background and the M3_Theme surface-container color token for Mat_Card backgrounds.
2. THE Dashboard SHALL use the M3_Theme primary color token for primary action Mat_Button components and the M3_Theme error color token for destructive or error elements.
3. THE Dashboard SHALL render primary action buttons using the mat-flat-button directive with the color attribute set to "primary".
4. THE Dashboard SHALL render secondary action buttons using the mat-stroked-button directive.
5. THE Dashboard SHALL render all form inputs inside Mat_Form_Field components with the "outline" appearance.

### Requirement 4: Loading States and Feedback

**User Story:** As a user, I want to see visual feedback when data is loading, so that I know the application is working and I should wait.

#### Acceptance Criteria

1. WHILE the Ingestion_Form is submitting a request, THE Ingestion_Form SHALL display a Mat_Progress_Bar in indeterminate mode below the form input.
2. WHILE the Ingestion_Form is submitting a request, THE Ingestion_Form SHALL disable the submit Mat_Button.
3. WHILE the Dashboard is fetching repository metadata, THE Dashboard SHALL display Skeleton_Loader placeholders in the Language_Summary, Framework_List, and Dependency_Panel Mat_Card containers.
4. WHEN an ingestion completes successfully, THE Dashboard SHALL display a Mat_Snack_Bar with the message "Ingestion completed successfully".
5. WHEN a token save operation completes successfully, THE Token_Settings SHALL display a Mat_Snack_Bar with the message "Tokens saved successfully".
6. WHEN a Mat_Snack_Bar is displayed, THE Dashboard SHALL auto-dismiss the Mat_Snack_Bar after 5 seconds using the MatSnackBar duration configuration.

### Requirement 5: Empty States

**User Story:** As a user, I want to see helpful messages when no data is available, so that I understand why a section is empty and what action to take.

#### Acceptance Criteria

1. WHEN no ingestion has been triggered, THE Dashboard SHALL display an empty state message "Enter a repository path or URL above to get started" below the Ingestion_Form.
2. WHEN the Language_Summary has no languages to display, THE Language_Summary SHALL display an empty state with a Mat_Icon and the text "No languages detected".
3. WHEN the Framework_List has no frameworks to display, THE Framework_List SHALL display an empty state with a Mat_Icon and the text "No frameworks detected".
4. WHEN the Dependency_Panel has no dependencies to display, THE Dependency_Panel SHALL display an empty state with a Mat_Icon and the text "No dependencies found".

### Requirement 6: Dependency Panel Interaction

**User Story:** As a user, I want the dependency panel's collapsible groups to have clear visual affordances, so that I can tell which groups are expandable and what their current state is.

#### Acceptance Criteria

1. THE Dependency_Panel SHALL render each ecosystem group as a Mat_Expansion_Panel inside a mat-accordion container.
2. THE Dependency_Panel SHALL display the ecosystem name and dependency count in each Mat_Expansion_Panel header.
3. WHEN a Mat_Expansion_Panel is expanded, THE Dependency_Panel SHALL display the dependency list inside the panel body.
4. THE Dependency_Panel SHALL include a "Collapse All" and "Expand All" Mat_Button above the mat-accordion, using the mat-stroked-button directive.

### Requirement 7: Table Styling and Usability

**User Story:** As a user, I want data tables to be easy to read, so that I can quickly scan framework and dependency information.

#### Acceptance Criteria

1. THE Framework_List and Dependency_Panel SHALL render tabular data using Mat_Table components with defined column definitions.
2. THE Framework_List Mat_Table and Dependency_Panel Mat_Table components SHALL apply the mat-row hover highlight provided by Angular Material styling.
3. THE Framework_List Mat_Table and Dependency_Panel Mat_Table components SHALL use mat-header-row for header rendering with M3_Theme surface-variant color token styling.
4. THE Framework_List Mat_Table and Dependency_Panel Mat_Table components SHALL use the M3_Theme typography tokens for consistent cell text sizing and padding.

### Requirement 8: Form Validation and Error Display

**User Story:** As a user, I want clear validation messages on forms, so that I know what to correct before submitting.

#### Acceptance Criteria

1. WHEN the Ingestion_Form input is empty and the user attempts to submit, THE Ingestion_Form SHALL display a mat-error element inside the Mat_Form_Field with the message "Repository path or URL is required".
2. WHEN the Ingestion_Form receives an error response from the backend, THE Ingestion_Form SHALL display the error message in a Mat_Card styled with the M3_Theme error-container color token.
3. WHEN the Token_Settings form is submitted with no tokens entered, THE Token_Settings SHALL display a mat-error element inside the Mat_Form_Field with the message "Enter at least one token to save".
4. IF the Migration_Trigger is activated without selecting a migration type, THEN THE Migration_Trigger SHALL display a mat-error element with the message "Select a migration type".

### Requirement 9: Responsive Typography

**User Story:** As a user, I want text to be readable on all screen sizes, so that I can use the dashboard on different devices.

#### Acceptance Criteria

1. THE Dashboard SHALL render the Mat_Toolbar title using the M3_Theme headline-small typography level on viewports wider than 768px and title-large on viewports 768px or narrower.
2. THE Dashboard SHALL render Mat_Card section headings using the M3_Theme title-medium typography level.
3. THE Dashboard SHALL render body text and Mat_Table content using the M3_Theme body-medium typography level with a minimum font size of 14px.
4. THE Dashboard SHALL set line-height to 1.5 for all body text to maintain readability.
