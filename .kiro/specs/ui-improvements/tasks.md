# Implementation Plan: UI Improvements with Angular Material 3

## Overview

Transform the Repository Metadata Dashboard from a flat, unstyled layout into a structured, responsive, M3-themed interface by incrementally adding Angular Material dependencies, theming, layout components, loading/empty states, form validation, and interaction feedback.

## Tasks

- [x] 1. Install Angular Material and configure theming foundation
  - [x] 1.1 Add `@angular/material` and `fast-check` dependencies
    - Add `@angular/material` to `frontend/package.json` dependencies
    - Add `fast-check` to `frontend/package.json` devDependencies
    - Run `npm install` in the `frontend` directory
    - _Requirements: 1.1_

  - [x] 1.2 Create M3 theme file and convert global styles to SCSS
    - Create `frontend/src/_theme.scss` with `mat.define-theme()` using blue seed color and Roboto typography
    - Rename `frontend/src/styles.css` to `frontend/src/styles.scss`
    - Import the theme in `styles.scss` and apply via `@include mat.all-component-themes($app-theme)`
    - Add body styles using M3 surface color token, Roboto font, and `line-height: 1.5`
    - Add `mat-card` background using `--mat-sys-surface-container` token
    - Update `frontend/angular.json` to reference `styles.scss` instead of `styles.css`
    - _Requirements: 1.2, 1.3, 3.1, 9.4_

  - [x] 1.3 Add Material Symbols and Roboto font links to index.html
    - Add Material Symbols icon font `<link>` to `frontend/src/index.html`
    - Add Roboto font `<link>` to `frontend/src/index.html`
    - _Requirements: 1.5_

  - [x] 1.4 Import Angular Material modules into DashboardModule
    - Import `MatCardModule`, `MatToolbarModule`, `MatButtonModule`, `MatFormFieldModule`, `MatInputModule`, `MatProgressBarModule`, `MatSnackBarModule`, `MatExpansionModule`, `MatTableModule`, `MatIconModule`, `MatSelectModule` into `frontend/src/app/dashboard/dashboard.module.ts`
    - _Requirements: 1.1_

- [x] 2. Checkpoint - Verify M3 foundation compiles
  - Ensure the project builds successfully with `ng build`, ask the user if questions arise.

- [x] 3. Implement dashboard layout with mat-toolbar and mat-card containers
  - [x] 3.1 Add mat-toolbar header and CSS grid layout to DashboardComponent
    - Add `mat-toolbar` with title "Repository Metadata Dashboard" to `frontend/src/app/dashboard/dashboard.component.ts` inline template
    - Wrap each section (IngestionForm, IngestionStatus, ErrorBanner, LanguageSummary, FrameworkList, DependencyPanel, TokenSettings, MigrationTrigger) in `mat-card` containers with `mat-card-header` and `mat-card-content`
    - Add `.dashboard-container` with flex column layout and 16px gap
    - Add `.two-column-grid` CSS grid for LanguageSummary and FrameworkList side by side
    - Add `@media (max-width: 768px)` breakpoint to stack `.two-column-grid` into single column
    - Add `loadingMetadata` boolean property to control skeleton loaders
    - Add empty state message "Enter a repository path or URL above to get started" when no ingestion triggered
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1_

  - [x] 3.2 Apply responsive typography classes
    - Use `mat-headline-small` on toolbar title for viewports > 768px and `mat-title-large` for ≤ 768px
    - Use `mat-title-medium` for mat-card section headings
    - Use `mat-body-medium` for body text with minimum 14px font size
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 3.3 Style buttons with M3 directives
    - Apply `mat-flat-button` with `color="primary"` to all primary action buttons
    - Apply `mat-stroked-button` to all secondary action buttons
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 4. Implement IngestionForm Material components and validation
  - [x] 4.1 Wrap IngestionForm input in mat-form-field with validation
    - Wrap the repository input in `mat-form-field` with `appearance="outline"` in `frontend/src/app/dashboard/components/ingestion-form/ingestion-form.component.ts`
    - Add `mat-error` with message "Repository path or URL is required" for empty input validation
    - Add `mat-progress-bar` in indeterminate mode shown when `loading` is true
    - Disable submit button when `loading` is true
    - Use `mat-flat-button` with `color="primary"` for the submit button
    - _Requirements: 3.5, 4.1, 4.2, 8.1_

  - [x] 4.2 Add snackbar and error display to IngestionForm
    - Inject `MatSnackBar` into `IngestionFormComponent`
    - Call `MatSnackBar.open("Ingestion completed successfully", "Close", { duration: 5000 })` on successful ingestion
    - Display backend error responses in a `mat-card` styled with `error-container` color token
    - _Requirements: 4.4, 4.6, 8.2_

  - [ ]* 4.3 Write property test for form field outline appearance (Property 1)
    - **Property 1: Form field outline appearance**
    - Query all `mat-form-field` elements in the dashboard and assert `appearance === 'outline'`
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 3.5**

  - [ ]* 4.4 Write property test for snackbar auto-dismiss duration (Property 2)
    - **Property 2: Snackbar auto-dismiss duration**
    - Spy on `MatSnackBar.open()`, trigger success scenarios, assert duration config is 5000ms
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 4.6**

- [x] 5. Implement loading states and empty states for data panels
  - [x] 5.1 Add loading input and skeleton loaders to LanguageSummaryComponent
    - Add `@Input() loading: boolean` to `frontend/src/app/dashboard/components/language-summary/language-summary.component.ts`
    - Show `mat-progress-bar` in indeterminate mode when `loading` is true
    - Add empty state with `mat-icon` and text "No languages detected" when languages array is empty/null and not loading
    - _Requirements: 4.3, 5.2_

  - [x] 5.2 Add loading input, skeleton loaders, and mat-table to FrameworkListComponent
    - Add `@Input() loading: boolean` to `frontend/src/app/dashboard/components/framework-list/framework-list.component.ts`
    - Show `mat-progress-bar` in indeterminate mode when `loading` is true
    - Replace HTML table with `mat-table` with column definitions for framework name and version
    - Add `mat-header-row` and `mat-row` definitions with hover highlight
    - Style header row with M3 `surface-variant` color token
    - Add empty state with `mat-icon` and text "No frameworks detected" when frameworks array is empty/null and not loading
    - Add `displayedColumns` property for mat-table column definitions
    - _Requirements: 4.3, 5.3, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 5.3 Write unit tests for loading and empty states
    - Test `mat-progress-bar` appears when `loading` is true on LanguageSummary and FrameworkList
    - Test empty state messages render with correct text and `mat-icon` when data is empty
    - Test skeleton loaders are hidden when `loading` is false
    - _Requirements: 4.3, 5.2, 5.3_

- [x] 6. Checkpoint - Verify layout, loading, and empty states
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement DependencyPanel with mat-expansion-panel and mat-table
  - [x] 7.1 Refactor DependencyPanelComponent with Material components
    - Add `@Input() loading: boolean` to `frontend/src/app/dashboard/components/dependency-panel/dependency-panel.component.ts`
    - Show `mat-progress-bar` in indeterminate mode when `loading` is true
    - Replace custom accordion with `mat-accordion` containing `mat-expansion-panel` per ecosystem group
    - Display ecosystem name and dependency count in each `mat-expansion-panel-header`
    - Replace HTML tables inside panels with `mat-table` with column definitions
    - Add `mat-header-row` and `mat-row` with hover highlight and `surface-variant` header styling
    - Add empty state with `mat-icon` and text "No dependencies found" when dependencies are empty/null
    - Add `@ViewChild(MatAccordion)` reference for programmatic expand/collapse
    - Add "Expand All" and "Collapse All" `mat-stroked-button` buttons above the accordion
    - _Requirements: 4.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 7.2 Write property test for dependency ecosystem grouping (Property 3)
    - **Property 3: Dependency ecosystem grouping with header content**
    - Generate random arrays of `RepositoryDependency` objects with `fast-check`
    - Assert number of `mat-expansion-panel` elements equals unique ecosystem count
    - Assert each panel header contains ecosystem name and correct dependency count
    - Use minimum 100 iterations
    - **Validates: Requirements 6.1, 6.2**

- [x] 8. Implement TokenSettings and MigrationTrigger Material components
  - [x] 8.1 Update TokenSettings with mat-form-field, validation, and snackbar
    - Wrap token inputs in `mat-form-field` with `appearance="outline"` in `frontend/src/app/dashboard/components/token-settings/token-settings.component.ts`
    - Add `mat-error` with message "Enter at least one token to save" for empty submission
    - Use `mat-flat-button` with `color="primary"` for save button and `mat-stroked-button` for secondary actions
    - Inject `MatSnackBar` and call `open("Tokens saved successfully", "Close", { duration: 5000 })` on successful save
    - _Requirements: 3.5, 4.5, 4.6, 8.3_

  - [x] 8.2 Update MigrationTrigger with mat-form-field, mat-select, and validation
    - Wrap select in `mat-form-field` with `appearance="outline"` and use `mat-select` in `frontend/src/app/dashboard/components/migration-trigger/migration-trigger.component.ts`
    - Add `mat-error` with message "Select a migration type" when no type selected
    - Use `mat-flat-button` with `color="primary"` for the trigger button
    - _Requirements: 3.5, 8.4_

  - [ ]* 8.3 Write unit tests for TokenSettings and MigrationTrigger validation
    - Test `mat-error` messages appear for empty token fields and missing migration type
    - Test snackbar is called with correct message and 5000ms duration on token save
    - Test button directives (`mat-flat-button`, `mat-stroked-button`) are applied correctly
    - _Requirements: 4.5, 4.6, 8.3, 8.4_

- [x] 9. Style ErrorBanner with M3 error tokens
  - [x] 9.1 Apply error-container styling to ErrorBannerComponent
    - Style the error banner `mat-card` with M3 `error-container` color token in `frontend/src/app/dashboard/components/error-banner/error-banner.component.ts`
    - Use M3 `error` color token for error text
    - _Requirements: 3.2_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All components use inline templates per existing project conventions
