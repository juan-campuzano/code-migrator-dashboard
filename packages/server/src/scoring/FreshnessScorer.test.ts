import { describe, it, expect } from 'vitest';
import { computePortfolioScore } from './FreshnessScorer';

describe('computePortfolioScore', () => {
  it('returns 100 when repos array is empty', () => {
    expect(computePortfolioScore([])).toBe(100);
  });

  it('returns 100 when all repos have zero scored dependencies', () => {
    const repos = [
      { weightedAverage: 50, scoredDependencyCount: 0 },
      { weightedAverage: 30, scoredDependencyCount: 0 },
    ];
    expect(computePortfolioScore(repos)).toBe(100);
  });

  it('returns the single repo score when only one repo has scored deps', () => {
    const repos = [{ weightedAverage: 75, scoredDependencyCount: 10 }];
    expect(computePortfolioScore(repos)).toBe(75);
  });

  it('computes weighted average across multiple repos', () => {
    // repo1: avg=80, deps=10 → contributes 800
    // repo2: avg=60, deps=20 → contributes 1200
    // total weight = 30, expected = 2000/30 ≈ 66.667
    const repos = [
      { weightedAverage: 80, scoredDependencyCount: 10 },
      { weightedAverage: 60, scoredDependencyCount: 20 },
    ];
    expect(computePortfolioScore(repos)).toBeCloseTo(2000 / 30, 10);
  });

  it('ignores repos with zero scored dependencies in the average', () => {
    const repos = [
      { weightedAverage: 90, scoredDependencyCount: 5 },
      { weightedAverage: 40, scoredDependencyCount: 0 }, // excluded
    ];
    // Only repo1 contributes: 90*5 / 5 = 90
    expect(computePortfolioScore(repos)).toBe(90);
  });

  it('handles equal weights correctly', () => {
    const repos = [
      { weightedAverage: 100, scoredDependencyCount: 5 },
      { weightedAverage: 0, scoredDependencyCount: 5 },
    ];
    // (100*5 + 0*5) / (5+5) = 500/10 = 50
    expect(computePortfolioScore(repos)).toBe(50);
  });
});
