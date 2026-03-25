# Implementation Plan: Repository Selector Menu

## Overview

Add a repository selector dropdown to the Dashboard toolbar using Angular Material `mat-select`. The implementation adds a `listRepositories()` method to `RepositoryService`, creates a new `RepositorySelectorComponent`, and wires it into `DashboardComponent` with event-driven refresh on ingestion completion. No backend changes needed.

## Tasks

- [x] 1. Add `listRepositories()` method to RepositoryService
  - [x] 1.1 Add `listRepositories()` to `packages/web/src/app/dashboard/services/repository.service.ts`
    - Import `Repository` from `repository.models`
    - Add method: `listRepositories(): Observable<Repository[]>` that calls `GET /api/repositories`
    - _Requirements: 1.1_

  - [ ]* 1.2 Write unit test for `listRepositories()` in `repository.service.spec.ts`
    - Verify correct HTTP GET call to `/api/repositories`
    - Verify the response is typed as `Repository[]`
    - _Requirements: 1.1_

- [x] 2. Create RepositorySelectorComponent
  - [x] 2.1 Create component file `packages/web/src/app/dashboard/components/repository-selector/repository-selector.component.ts`
    - Selector: `app-repository-selector`
    - Inputs: `autoSelectId: string | null`
    - Outputs: `selectionChange: EventEmitter<string>`
    - Internal state: `repositories`, `selectedId`, `loading`, `errorMessage`
    - On `ngOnInit`, call `RepositoryService.listRepositories()` to populate dropdown
    - On `ngOnChanges` when `autoSelectId` changes to non-null, re-fetch list and set `selectedId`
    - Emit `selectionChange` when user picks an option
    - Show loading placeholder while list is loading
    - Show "No repositories available" disabled state when list is empty
    - Display source-type icon (`folder` for local, `code` for github, `cloud` for azure_devops) next to each repository name using `mat-icon`
    - Ensure keyboard navigation and ARIA labeling on the `mat-select`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 5.1, 5.2_

  - [x] 2.2 Create spec file `packages/web/src/app/dashboard/components/repository-selector/repository-selector.component.spec.ts`
    - [x] 2.2.1 Write unit tests for RepositorySelectorComponent
      - Test loading state shown during fetch
      - Test error message displayed on API failure
      - Test disabled state and "No repositories available" when list is empty
      - Test that selecting an option emits `selectionChange` with correct repository id
      - Test that `autoSelectId` input triggers list refresh and auto-selection
      - Test source-type icons render correctly for each type
      - _Requirements: 1.2, 1.3, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 5.1, 5.2_

  - [ ]* 2.3 Write property test: Repository option rendering (Property 1)
    - **Property 1: Repository option rendering**
    - Generate arbitrary arrays of `Repository` objects using fast-check
    - Render selector with generated data
    - Assert every `mat-option` value equals the corresponding `id` and label contains the `name`
    - `// Feature: repository-selector-menu, Property 1: Repository option rendering`
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 2.4 Write property test: Source type icon mapping (Property 4)
    - **Property 4: Source type icon mapping**
    - Generate arbitrary repositories with random source types using fast-check
    - Render selector and assert each option contains the correct icon for its `sourceType`
    - Assert the three source types map to three distinct icons
    - `// Feature: repository-selector-menu, Property 4: Source type icon mapping`
    - **Validates: Requirements 5.1, 5.2**

- [x] 3. Checkpoint - Ensure selector component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate RepositorySelectorComponent into DashboardComponent
  - [x] 4.1 Register RepositorySelectorComponent in DashboardModule
    - Add import and declaration of `RepositorySelectorComponent` in `packages/web/src/app/dashboard/dashboard.module.ts`
    - _Requirements: 2.1_

  - [x] 4.2 Embed selector in DashboardComponent template and wire events
    - Add `<app-repository-selector>` in the toolbar area of `packages/web/src/app/dashboard/dashboard.component.ts`
    - Bind `[autoSelectId]` to a new `autoSelectRepositoryId` property
    - Handle `(selectionChange)` to call `fetchMetadata(repositoryId)` and set `repositoryId`
    - After ingestion completes in `onIngestionCompleted`, set `autoSelectRepositoryId` to the new repository id
    - Display error banner when repository list fetch fails (via error event from selector or existing error handling)
    - _Requirements: 1.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [ ]* 4.3 Write unit tests for DashboardComponent integration
    - Test that selecting a repository triggers `fetchMetadata`
    - Test error banner appears on metadata fetch failure
    - Test previous selection is retained on metadata fetch error
    - Test `autoSelectRepositoryId` is set after ingestion completes
    - _Requirements: 3.1, 3.2, 3.4, 4.1, 4.2_

  - [ ]* 4.4 Write property test: Metadata loads correctly on selection (Property 2)
    - **Property 2: Metadata loads correctly on selection**
    - Generate arbitrary repository list and arbitrary metadata using fast-check
    - Simulate selecting a random repository
    - Assert dashboard panels receive exactly the metadata returned by the service
    - `// Feature: repository-selector-menu, Property 2: Metadata loads correctly on selection`
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 4.5 Write property test: Post-ingestion refresh and auto-select (Property 3)
    - **Property 3: Post-ingestion refresh and auto-select**
    - Generate arbitrary initial repository list and a new repository id not in the list
    - Simulate ingestion-completed event
    - Assert refreshed list contains the new id and selector's `selectedId` equals the new id
    - `// Feature: repository-selector-menu, Property 3: Post-ingestion refresh and auto-select`
    - **Validates: Requirements 4.1, 4.2**

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in `devDependencies`) with minimum 100 iterations
- Unit tests use Jasmine + Karma (existing Angular test setup)
- No backend changes are needed; existing `GET /api/repositories` and `GET /api/repositories/:id/metadata` endpoints are sufficient
- Follow frontend-design skill guidelines from `.agents/skills/frontend-design/SKILL.md` when implementing component templates and styles
