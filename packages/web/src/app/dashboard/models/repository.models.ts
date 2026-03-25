export interface Repository {
  id: string;
  name: string;
  sourceType: 'local' | 'github' | 'azure_devops';
  sourceIdentifier: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionRecord {
  id: string;
  repositoryId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorDetails?: string;
  startedAt: string;
  completedAt?: string;
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

export interface MigrationStatus {
  migrationId: string;
  repositoryId: string;
  migrationType: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: string;
  errorDetails?: string;
  createdAt: string;
  updatedAt: string;
}


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

export interface FreshnessResponse {
  repositoryId: string;
  ingestionId: string | null;
  grade: RepositoryGrade;
  weightedAverage: number;
  computedAt: string;
  dependencies: DependencyFreshnessScore[];
}
