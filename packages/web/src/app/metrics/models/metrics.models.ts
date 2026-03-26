export type RepositoryGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface MetricsSummaryResponse {
  totalRepositories: number;
  portfolioScore: number;
  portfolioGrade: RepositoryGrade;
  repositories: RepositorySummary[];
  languageDistribution: LanguageDistributionEntry[];
}

export interface RepositorySummary {
  id: string;
  name: string;
  sourceType: 'local' | 'github' | 'azure_devops';
  freshnessGrade: RepositoryGrade | null;
  freshnessScore: number | null;
  freshnessStatus: 'scored' | 'pending';
  totalDependencies: number;
  productionDependencies: number;
  developmentDependencies: number;
  primaryLanguage: string | null;
  lastIngestionDate: string | null;
}

export interface LanguageDistributionEntry {
  language: string;
  totalFileCount: number;
  proportion: number;
}
