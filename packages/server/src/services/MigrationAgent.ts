import type { RepositoryDb } from '../db/RepositoryDb';
import type { TokenService } from './TokenService';
import type { FreshnessService } from './FreshnessService';
import type { GitHubService } from './GitHubService';
import type {
  AIProvider,
  AIProviderRequest,
  UpgradeTarget,
  MigrationStatus,
  MigrationParameters,
  FileEntry,
} from '../models/types';
import { resolveAgentInstructions, buildPrDescription, buildFallbackPrDescription } from './AIProvider';

// =============================================================================
// Configuration
// =============================================================================

export interface MigrationAgentConfig {
  pollIntervalMs: number;
  shutdownTimeoutMs: number;
  dashboardBaseUrl?: string;
  freshnessThreshold: number;
}

const DEFAULT_CONFIG: MigrationAgentConfig = {
  pollIntervalMs: 5000,
  shutdownTimeoutMs: 60000,
  freshnessThreshold: 0.8,
};

// =============================================================================
// Default agent instructions
// =============================================================================

const DEFAULT_AGENT_INSTRUCTIONS = `You are a dependency upgrade assistant. Follow these guidelines:
- Make minimal, conservative changes to upgrade the specified dependencies.
- Update version numbers in manifest files (package.json, pom.xml, build.gradle, etc.).
- Update import paths if the dependency has breaking API changes.
- Update test dependencies alongside production dependencies.
- Preserve existing code style and formatting conventions.
- Do not add new dependencies unless required by the upgrade.
- Do not remove existing functionality.`;

// =============================================================================
// Exported helper: filter dependencies by freshness threshold
// =============================================================================

export function filterDependenciesByThreshold(
  scores: Array<{ dependencyName: string; ecosystem: string; currentVersion: string; score: number }>,
  threshold: number,
): UpgradeTarget[] {
  return scores
    .filter((s) => s.score < threshold)
    .map((s) => ({
      dependencyName: s.dependencyName,
      ecosystem: s.ecosystem,
      currentVersion: s.currentVersion,
    }));
}

// =============================================================================
// Exported helper: parse config from environment variables
// =============================================================================

export function parseMigrationAgentConfig(
  env: Record<string, string | undefined>,
): MigrationAgentConfig {
  const pollIntervalMs = env.MIGRATION_POLL_INTERVAL_MS
    ? parseInt(env.MIGRATION_POLL_INTERVAL_MS, 10)
    : DEFAULT_CONFIG.pollIntervalMs;

  const shutdownTimeoutMs = env.MIGRATION_SHUTDOWN_TIMEOUT_MS
    ? parseInt(env.MIGRATION_SHUTDOWN_TIMEOUT_MS, 10)
    : DEFAULT_CONFIG.shutdownTimeoutMs;

  const freshnessThreshold = env.MIGRATION_FRESHNESS_THRESHOLD
    ? parseFloat(env.MIGRATION_FRESHNESS_THRESHOLD)
    : DEFAULT_CONFIG.freshnessThreshold;

  return {
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : DEFAULT_CONFIG.pollIntervalMs,
    shutdownTimeoutMs: Number.isFinite(shutdownTimeoutMs) ? shutdownTimeoutMs : DEFAULT_CONFIG.shutdownTimeoutMs,
    dashboardBaseUrl: env.DASHBOARD_BASE_URL,
    freshnessThreshold: Number.isFinite(freshnessThreshold) ? freshnessThreshold : DEFAULT_CONFIG.freshnessThreshold,
  };
}

// =============================================================================
// MigrationAgent
// =============================================================================

export class MigrationAgent {
  private readonly db: RepositoryDb;
  private readonly tokenService: TokenService;
  private readonly freshnessService: FreshnessService;
  private readonly aiProvider: AIProvider;
  private readonly githubService: GitHubService;
  private readonly config: MigrationAgentConfig;

  private running = false;
  private shuttingDown = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlightPromise: Promise<void> | null = null;
  private shutdownResolve: (() => void) | null = null;

  constructor(
    db: RepositoryDb,
    tokenService: TokenService,
    freshnessService: FreshnessService,
    aiProvider: AIProvider,
    githubService: GitHubService,
    config?: Partial<MigrationAgentConfig>,
  ) {
    this.db = db;
    this.tokenService = tokenService;
    this.freshnessService = freshnessService;
    this.aiProvider = aiProvider;
    this.githubService = githubService;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Start the poll loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.shuttingDown = false;
    this.scheduleTick();
  }

  /** Stop the agent gracefully. Waits for in-flight job up to shutdownTimeoutMs. */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.shuttingDown = true;
    this.running = false;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.inFlightPromise) {
      // Wait for in-flight job with timeout
      await Promise.race([
        this.inFlightPromise,
        new Promise<void>((resolve) => {
          setTimeout(resolve, this.config.shutdownTimeoutMs);
        }),
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Poll loop
  // ---------------------------------------------------------------------------

  private scheduleTick(): void {
    if (this.shuttingDown || !this.running) return;
    this.timer = setTimeout(() => this.tick(), this.config.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    if (this.shuttingDown) return;

    try {
      const job = await this.db.claimNextJob();
      if (!job) {
        this.scheduleTick();
        return;
      }

      this.inFlightPromise = this.processJob(job);
      await this.inFlightPromise;
      this.inFlightPromise = null;
    } catch {
      // Database error during claim — log and continue
      this.inFlightPromise = null;
    }

    this.scheduleTick();
  }

  // ---------------------------------------------------------------------------
  // Job processing
  // ---------------------------------------------------------------------------

  private async processJob(job: MigrationStatus): Promise<void> {
    try {
      // 1. Get GitHub token
      const token = await this.tokenService.getToken('github');
      if (!token) {
        await this.db.updateMigrationStatus(
          job.migrationId,
          'failed',
          undefined,
          'GitHub access token not configured.',
        );
        return;
      }

      // 2. Load repository
      const repository = await this.db.getRepository(job.repositoryId);
      if (!repository) {
        await this.db.updateMigrationStatus(
          job.migrationId,
          'failed',
          undefined,
          'Repository not found.',
        );
        return;
      }

      // 3. Parse owner/repo from source identifier
      const { owner, repo } = this.parseGitHubSource(repository.sourceIdentifier);

      // 4. Load repository context
      const metadata = await this.db.getRepositoryMetadata(job.repositoryId);
      const fileTree: FileEntry[] = metadata?.repository ? [] : [];
      const manifestContents: Record<string, string> = {};

      // 5. Build upgrade targets
      const params = (job.parameters ?? {}) as unknown as MigrationParameters;
      let upgradeTargets: UpgradeTarget[] = [];

      if (params.upgradeAll) {
        upgradeTargets = await this.buildUpgradeAllTargets(job.repositoryId);
      } else if (params.dependencies) {
        upgradeTargets = params.dependencies.map((d) => ({
          dependencyName: d.name,
          ecosystem: d.ecosystem ?? 'unknown',
          currentVersion: d.targetVersion ?? 'unknown',
        }));
      }

      // 6. Load agent instructions
      const agentInstructions = await this.loadAgentInstructions(
        owner,
        repo,
        token,
        params.customInstructions,
      );

      // 7. Call AI provider
      const request: AIProviderRequest = {
        upgradeTargets,
        agentInstructions,
        repositoryContext: {
          fileTree,
          manifestContents,
          repoName: repository.name,
        },
      };

      const aiResponse = await this.aiProvider.generateChanges(request);

      // 8. If file changes were produced, create branch, commit, open PR
      if (aiResponse.fileChanges.length > 0) {
        const description = upgradeTargets.map((t) => t.dependencyName).join('-');
        const branchName = GitHubServiceStatic.buildBranchName(job.migrationId, description);

        const defaultBranch = await this.githubService.getDefaultBranch({ owner, repo, token });

        await this.githubService.createBranch({
          owner,
          repo,
          branchName,
          token,
        });

        const commitMessage = `chore: upgrade ${upgradeTargets.map((t) => t.dependencyName).join(', ')}`;
        await this.githubService.commitChanges({
          owner,
          repo,
          branchName,
          token,
          changes: aiResponse.fileChanges,
          commitMessage,
        });

        // Build PR description
        let prBody = aiResponse.prDescription;
        if (!prBody) {
          prBody = buildFallbackPrDescription(upgradeTargets, aiResponse.fileChanges);
        }

        // Append dashboard link if configured
        if (this.config.dashboardBaseUrl) {
          const dashboardDesc = buildPrDescription(
            upgradeTargets,
            aiResponse.fileChanges,
            this.config.dashboardBaseUrl,
            job.migrationId,
          );
          prBody = dashboardDesc;
        }

        const prTitle = `[Migration Agent] Upgrade ${upgradeTargets.map((t) => t.dependencyName).join(', ')}`;
        const { prUrl } = await this.githubService.createPullRequest({
          owner,
          repo,
          token,
          head: branchName,
          base: defaultBranch,
          title: prTitle,
          body: prBody,
        });

        await this.db.updateMigrationStatus(job.migrationId, 'completed', prUrl);
      } else {
        // No file changes — mark completed with note
        await this.db.updateMigrationStatus(
          job.migrationId,
          'completed',
          'No file changes generated by AI provider.',
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      try {
        await this.db.updateMigrationStatus(
          job.migrationId,
          'failed',
          undefined,
          errorMessage,
        );
      } catch {
        // If we can't update the status, log and move on
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async buildUpgradeAllTargets(repositoryId: string): Promise<UpgradeTarget[]> {
    const freshnessResult = await this.db.getFreshnessScores(repositoryId);
    if (!freshnessResult) return [];

    const scores = freshnessResult.dependencies
      .filter((d) => d.status === 'scored' && d.score !== null)
      .map((d) => ({
        dependencyName: d.dependencyName,
        ecosystem: d.ecosystem,
        currentVersion: d.resolvedVersion ?? 'unknown',
        score: d.score as number,
      }));

    return filterDependenciesByThreshold(scores, this.config.freshnessThreshold);
  }

  private async loadAgentInstructions(
    owner: string,
    repo: string,
    token: string,
    customInstructions?: string,
  ): Promise<string> {
    // If custom instructions are provided, use them directly (skip repo fetch)
    if (customInstructions !== undefined && customInstructions !== null) {
      return resolveAgentInstructions(customInstructions, null, DEFAULT_AGENT_INSTRUCTIONS);
    }

    // Try to fetch .migration-agent.md from the repo
    let repoFileContent: string | null = null;
    try {
      repoFileContent = await this.githubService.getFileContent({
        owner,
        repo,
        token,
        path: '.migration-agent.md',
      });
    } catch {
      // If fetching fails, fall back to defaults
    }

    return resolveAgentInstructions(customInstructions, repoFileContent, DEFAULT_AGENT_INSTRUCTIONS);
  }

  private parseGitHubSource(sourceIdentifier: string): { owner: string; repo: string } {
    // Expect format like https://github.com/owner/repo or owner/repo
    const match = sourceIdentifier.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
    // Fallback: try owner/repo format
    const parts = sourceIdentifier.split('/');
    if (parts.length >= 2) {
      return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
    }
    return { owner: 'unknown', repo: 'unknown' };
  }
}

// Import the static method from GitHubService
import { GitHubService as GitHubServiceStatic } from './GitHubService';
