import { describe, it, expect } from 'vitest';
import { aggregateLanguages } from './metricsUtils';
import { RepositoryLanguage } from '../models/types';

describe('aggregateLanguages', () => {
  it('returns empty array when given no repositories', () => {
    expect(aggregateLanguages([])).toEqual([]);
  });

  it('returns empty array when all repositories have empty language arrays', () => {
    expect(aggregateLanguages([[], []])).toEqual([]);
  });

  it('sums fileCount per language across repositories', () => {
    const input: RepositoryLanguage[][] = [
      [
        { language: 'TypeScript', fileCount: 10, proportion: 0.5 },
        { language: 'JavaScript', fileCount: 10, proportion: 0.5 },
      ],
      [
        { language: 'TypeScript', fileCount: 5, proportion: 0.5 },
        { language: 'Python', fileCount: 5, proportion: 0.5 },
      ],
    ];

    const result = aggregateLanguages(input);

    expect(result).toEqual([
      { language: 'TypeScript', totalFileCount: 15, proportion: 15 / 30 },
      { language: 'JavaScript', totalFileCount: 10, proportion: 10 / 30 },
      { language: 'Python', totalFileCount: 5, proportion: 5 / 30 },
    ]);
  });

  it('sorts descending by totalFileCount', () => {
    const input: RepositoryLanguage[][] = [
      [
        { language: 'Go', fileCount: 1, proportion: 0.1 },
        { language: 'Rust', fileCount: 9, proportion: 0.9 },
      ],
      [
        { language: 'Go', fileCount: 20, proportion: 1 },
      ],
    ];

    const result = aggregateLanguages(input);

    expect(result[0].language).toBe('Go');
    expect(result[0].totalFileCount).toBe(21);
    expect(result[1].language).toBe('Rust');
    expect(result[1].totalFileCount).toBe(9);
  });

  it('computes correct proportions that sum to 1', () => {
    const input: RepositoryLanguage[][] = [
      [
        { language: 'A', fileCount: 3, proportion: 1 },
      ],
      [
        { language: 'B', fileCount: 7, proportion: 1 },
      ],
    ];

    const result = aggregateLanguages(input);
    const proportionSum = result.reduce((sum, e) => sum + e.proportion, 0);

    expect(proportionSum).toBeCloseTo(1, 10);
    expect(result[0]).toEqual({ language: 'B', totalFileCount: 7, proportion: 0.7 });
    expect(result[1]).toEqual({ language: 'A', totalFileCount: 3, proportion: 0.3 });
  });

  it('handles a single repository with a single language', () => {
    const input: RepositoryLanguage[][] = [
      [{ language: 'Java', fileCount: 42, proportion: 1 }],
    ];

    const result = aggregateLanguages(input);

    expect(result).toEqual([
      { language: 'Java', totalFileCount: 42, proportion: 1 },
    ]);
  });
});
