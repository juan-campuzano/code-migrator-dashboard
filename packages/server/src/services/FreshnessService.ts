// =============================================================================
// FreshnessService — orchestrates the full freshness scoring pipeline
// =============================================================================

import { RepositoryDb } from '../db/RepositoryDb';
import { RegistryClient, RegistryLookupResult } from '../scoring/RegistryClient';
import { resolveVersion } from '../scoring/VersionResolver';
import { scoreOne, aggregate } from '../scoring/FreshnessScorer';
import { FreshnessResult, DependencyFreshnessScore, RepositoryDependency } from '../models/types';

export class FreshnessService {
  private readonly inProgress = new Set<string>();

  constructor(
    private readonly db: RepositoryDb,
    private readonly registryClient: RegistryClient,
  ) {}

  /**
   * Check whether scoring is currently in progress for a repository.
   */
  isScoring(repositoryId: string): boolean {
    return this.inProgress.has(repositoryId);
  }

  /**
   * Full scoring pipeline: load deps → fetch latest → resolve → score → aggregate → persist.
   */
  async computeScores(repositoryId: string, ingestionId?: string): Promise<void> {
    this.inProgress.add(repositoryId);
    try {
      // 1. Load dependencies from DB
      const deps = await this.db.getRepositoryDependencies(repositoryId);

      // 2. Fetch latest versions from registries
      const lookups = await this.registryClient.fetchMany(
        deps.map((d) => ({ ecosystem: d.ecosystem, name: d.name })),
      );

      // Build a lookup map keyed by ecosystem::name
      const lookupMap = new Map<string, RegistryLookupResult>();
      for (const lr of lookups) {
        lookupMap.set(`${lr.ecosystem}::${lr.packageName}`, lr);
      }

      // 3. Resolve, score, and build per-dependency results
      const depScores: DependencyFreshnessScore[] = [];
      const scorableEntries: Array<{ score: number; dependencyType: 'production' | 'development' }> = [];

      for (const dep of deps) {
        const depScore = this.scoreDependency(dep, lookupMap);
        depScores.push(depScore);

        if (depScore.status === 'scored' && depScore.score !== null) {
          scorableEntries.push({ score: depScore.score, dependencyType: dep.dependencyType });
        }
      }

      // 4. Aggregate scores
      const { weightedAverage, grade } = aggregate(scorableEntries);

      // 5. Build and persist result
      const result: FreshnessResult = {
        repositoryId,
        ingestionId: ingestionId ?? null,
        grade,
        weightedAverage,
        computedAt: new Date(),
        dependencies: depScores,
      };

      await this.db.upsertFreshnessScores(repositoryId, ingestionId ?? null, result);
    } finally {
      this.inProgress.delete(repositoryId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private scoreDependency(
    dep: RepositoryDependency,
    lookupMap: Map<string, RegistryLookupResult>,
  ): DependencyFreshnessScore {
    const lookup = lookupMap.get(`${dep.ecosystem}::${dep.name}`);

    // Registry error
    if (lookup?.error) {
      return {
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        resolvedVersion: null,
        latestVersion: null,
        score: null,
        dependencyType: dep.dependencyType,
        status: 'error',
        error: lookup.error,
      };
    }

    // Unresolved from registry (not found / no latest version)
    if (!lookup?.latestVersion) {
      return {
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        resolvedVersion: null,
        latestVersion: null,
        score: null,
        dependencyType: dep.dependencyType,
        status: 'unresolved',
      };
    }

    // Resolve the version constraint
    const versionResult = resolveVersion(dep.ecosystem, dep.versionConstraint);

    // Unpinned constraint (empty/absent)
    if (versionResult.unpinned) {
      return {
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        resolvedVersion: null,
        latestVersion: lookup.latestVersion,
        score: 0,
        dependencyType: dep.dependencyType,
        status: 'unpinned',
      };
    }

    // Warning — constraint could not be parsed
    if (versionResult.warning || !versionResult.resolved) {
      return {
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        resolvedVersion: null,
        latestVersion: lookup.latestVersion,
        score: null,
        dependencyType: dep.dependencyType,
        status: 'error',
        error: versionResult.warning ?? 'Unable to resolve version constraint',
      };
    }

    // Parse the latest version string into components
    const latestParsed = this.parseSemver(lookup.latestVersion);
    if (!latestParsed) {
      return {
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        resolvedVersion: this.formatVersion(versionResult.resolved),
        latestVersion: lookup.latestVersion,
        score: null,
        dependencyType: dep.dependencyType,
        status: 'error',
        error: `Unable to parse latest version: "${lookup.latestVersion}"`,
      };
    }

    // Compute score
    const score = scoreOne(versionResult.resolved, latestParsed);

    return {
      dependencyName: dep.name,
      ecosystem: dep.ecosystem,
      resolvedVersion: this.formatVersion(versionResult.resolved),
      latestVersion: lookup.latestVersion,
      score,
      dependencyType: dep.dependencyType,
      status: 'scored',
    };
  }

  private parseSemver(raw: string): { major: number; minor: number; patch: number; prerelease?: string } | null {
    const trimmed = raw.trim().replace(/^v/, '');
    const match = trimmed.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(.+))?$/);
    if (!match) return null;
    return {
      major: parseInt(match[1], 10),
      minor: match[2] !== undefined ? parseInt(match[2], 10) : 0,
      patch: match[3] !== undefined ? parseInt(match[3], 10) : 0,
      prerelease: match[4] || undefined,
    };
  }

  private formatVersion(v: { major: number; minor: number; patch: number; prerelease?: string }): string {
    const base = `${v.major}.${v.minor}.${v.patch}`;
    return v.prerelease ? `${base}-${v.prerelease}` : base;
  }
}
