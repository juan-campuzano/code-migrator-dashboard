// =============================================================================
// FreshnessScorer — computes per-dependency freshness scores and aggregates
// =============================================================================

import { ResolvedVersion } from './VersionResolver';
import { RepositoryGrade } from '../models/types';

/**
 * Compute a freshness score (0–100) for a single dependency by comparing
 * its resolved version against the latest available version.
 *
 * Algorithm:
 * 1. Compute diffs for major, minor, and patch.
 * 2. Identical versions (no prerelease diff) → 100.
 * 3. Same major.minor.patch but resolved has prerelease and latest does not → 90.
 * 4. 4+ major versions behind → 0.
 * 5. Otherwise: 100 - (majorDiff × 30) - (max(0, minorDiff) × 5) - (max(0, patchDiff) × 1), clamped to [0, 100].
 */
export function scoreOne(resolved: ResolvedVersion, latest: ResolvedVersion): number {
  const majorDiff = latest.major - resolved.major;
  const minorDiff = latest.minor - resolved.minor;
  const patchDiff = latest.patch - resolved.patch;

  // Identical versions with matching (or absent) prerelease
  if (
    majorDiff === 0 &&
    minorDiff === 0 &&
    patchDiff === 0
  ) {
    if (!resolved.prerelease || resolved.prerelease === latest.prerelease) {
      return 100;
    }
    // Same version numbers but resolved has prerelease, latest does not
    return 90;
  }

  // 4 or more major versions behind
  if (majorDiff >= 4) {
    return 0;
  }

  const raw = 100 - (majorDiff * 30) - (Math.max(0, minorDiff) * 5) - (Math.max(0, patchDiff) * 1);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Aggregate an array of per-dependency scores into a weighted average and grade.
 *
 * Production dependencies are weighted 2×, development dependencies 1×.
 * If no dependencies are provided, returns score 100 and grade 'A'.
 */
export function aggregate(
  scores: Array<{ score: number; dependencyType: 'production' | 'development' }>,
): { weightedAverage: number; grade: RepositoryGrade } {
  if (scores.length === 0) {
    return { weightedAverage: 100, grade: 'A' };
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of scores) {
    const weight = entry.dependencyType === 'production' ? 2 : 1;
    weightedSum += entry.score * weight;
    totalWeight += weight;
  }

  const weightedAverage = weightedSum / totalWeight;
  const grade = mapScoreToGrade(weightedAverage);

  return { weightedAverage, grade };
}

/**
 * Map a numeric score to a letter grade.
 *
 * A: 90–100, B: 70–89, C: 50–69, D: 30–49, E: 0–29
 */
export function mapScoreToGrade(score: number): RepositoryGrade {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'E';
}
