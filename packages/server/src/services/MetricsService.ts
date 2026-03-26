import { RepositoryDb } from '../db/RepositoryDb';
import {
  MetricsSummaryResponse,
  RepositorySummary,
  RepositoryLanguage,
} from '../models/types';
import { computePortfolioScore, mapScoreToGrade } from '../scoring/FreshnessScorer';
import { aggregateLanguages } from './metricsUtils';

export class MetricsService {
  constructor(private readonly db: RepositoryDb) {}

  async computeSummary(): Promise<MetricsSummaryResponse> {
    const repos = await this.db.listRepositories();

    if (repos.length === 0) {
      return {
        totalRepositories: 0,
        portfolioScore: 100,
        portfolioGrade: 'A',
        repositories: [],
        languageDistribution: [],
      };
    }

    const allLanguages: RepositoryLanguage[][] = [];
    const portfolioInputs: Array<{ weightedAverage: number; scoredDependencyCount: number }> = [];
    const summaries: RepositorySummary[] = [];

    for (const repo of repos) {
      const [freshness, dependencies, languages, latestIngestion] = await Promise.all([
        this.db.getFreshnessScores(repo.id),
        this.db.getRepositoryDependencies(repo.id),
        this.db.getRepositoryLanguages(repo.id),
        this.db.getLatestIngestion(repo.id),
      ]);

      allLanguages.push(languages);

      const totalDeps = dependencies.length;
      const prodDeps = dependencies.filter(d => d.dependencyType === 'production').length;
      const devDeps = dependencies.filter(d => d.dependencyType === 'development').length;
      const primaryLanguage = languages.length > 0 ? languages[0].language : null;
      const lastIngestionDate = latestIngestion?.completedAt?.toISOString() ?? latestIngestion?.startedAt?.toISOString() ?? null;

      if (freshness) {
        const scoredDeps = freshness.dependencies.filter(d => d.status === 'scored');
        portfolioInputs.push({
          weightedAverage: freshness.weightedAverage,
          scoredDependencyCount: scoredDeps.length,
        });

        summaries.push({
          id: repo.id,
          name: repo.name,
          sourceType: repo.sourceType,
          freshnessGrade: freshness.grade,
          freshnessScore: freshness.weightedAverage,
          freshnessStatus: 'scored',
          totalDependencies: totalDeps,
          productionDependencies: prodDeps,
          developmentDependencies: devDeps,
          primaryLanguage,
          lastIngestionDate,
        });
      } else {
        summaries.push({
          id: repo.id,
          name: repo.name,
          sourceType: repo.sourceType,
          freshnessGrade: null,
          freshnessScore: null,
          freshnessStatus: 'pending',
          totalDependencies: totalDeps,
          productionDependencies: prodDeps,
          developmentDependencies: devDeps,
          primaryLanguage,
          lastIngestionDate,
        });
      }
    }

    const portfolioScore = computePortfolioScore(portfolioInputs);
    const portfolioGrade = mapScoreToGrade(portfolioScore);
    const languageDistribution = aggregateLanguages(allLanguages);

    return {
      totalRepositories: repos.length,
      portfolioScore,
      portfolioGrade,
      repositories: summaries,
      languageDistribution,
    };
  }
}
