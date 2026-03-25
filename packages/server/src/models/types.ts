// =============================================================================
// Source Adapters
// =============================================================================

export interface FileEntry {
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface FetchResult {
  fileTree: FileEntry[];
  files: FileContent[];
}

export interface SourceAdapter {
  fetch(source: RepositorySource): Promise<FetchResult>;
}

// =============================================================================
// Scanner
// =============================================================================

export interface Technology {
  name: string;
  type: 'language' | 'framework';
  version?: string;
}

export interface Dependency {
  name: string;
  versionConstraint?: string;
  ecosystem: string;
  dependencyType: 'production' | 'development';
}

export interface ScanResult {
  technologies: Technology[];
  dependencies: Dependency[];
  errors: ScanError[];
}

export interface ScanError {
  file: string;
  message: string;
}

// =============================================================================
// Parsers
// =============================================================================

export interface ParsedDependency {
  name: string;
  versionConstraint?: string;
  dependencyType: 'production' | 'development';
}

export interface ManifestParseResult {
  ecosystem: string;
  dependencies: ParsedDependency[];
  errors: ParseError[];
}

export interface ParseError {
  entry: string;
  message: string;
}

export interface ManifestParser {
  readonly filenames: string[];
  parse(content: string): ManifestParseResult;
}

// =============================================================================
// Ingestion
// =============================================================================

export type RepositorySource =
  | { type: 'local'; path: string }
  | { type: 'github'; url: string; token: string }
  | { type: 'azure_devops'; url: string; token: string };

export interface IngestionRequest {
  source: RepositorySource;
}

// =============================================================================
// Data Models
// =============================================================================

export interface Repository {
  id: string;
  name: string;
  sourceType: 'local' | 'github' | 'azure_devops';
  sourceIdentifier: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngestionRecord {
  id: string;
  repositoryId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorDetails?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface RepositoryLanguage {
  language: string;
  fileCount: number;
  proportion: number;
}

export interface RepositoryFramework {
  name: string;
  version?: string;
}

export interface RepositoryDependency {
  ecosystem: string;
  name: string;
  versionConstraint?: string;
  dependencyType: 'production' | 'development';
}

export interface RepositoryMetadata {
  repository: Repository;
  latestIngestion: IngestionRecord;
  languages: RepositoryLanguage[];
  frameworks: RepositoryFramework[];
  dependencies: RepositoryDependency[];
}

// =============================================================================
// Error
// =============================================================================

export interface ApiError {
  code: string;
  message: string;
  provider?: string;
  retryAfter?: number;
}

// =============================================================================
// Freshness Scoring
// =============================================================================

export type RepositoryGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface DependencyFreshnessScore {
  dependencyName: string;
  ecosystem: string;
  resolvedVersion: string | null;
  latestVersion: string | null;
  score: number | null;
  dependencyType: 'production' | 'development';
  status: 'scored' | 'unresolved' | 'unpinned' | 'error';
  error?: string;
}

export interface FreshnessResult {
  repositoryId: string;
  ingestionId: string | null;
  grade: RepositoryGrade;
  weightedAverage: number;
  computedAt: Date;
  dependencies: DependencyFreshnessScore[];
}

// =============================================================================
// Migrations (placeholder)
// =============================================================================

export interface MigrationRequest {
  repositoryId: string;
  migrationType: string;
  parameters?: Record<string, string>;
}

export interface MigrationResponse {
  migrationId: string;
  status: 'queued';
}

export interface MigrationStatus {
  migrationId: string;
  repositoryId: string;
  migrationType: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  parameters?: Record<string, string>;
  result?: string;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

