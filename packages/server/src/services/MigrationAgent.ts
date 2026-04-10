import type { RepositoryDb } from '../db/RepositoryDb';
import type { TokenService } from './TokenService';
import type { FreshnessService } from './FreshnessService';
import type { GitHubService } from './GitHubService';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  UpgradeTarget,
  MigrationStatus,
  MigrationParameters,
  FileEntry,
  FileChange,
  ValidationRequest,
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
  maxValidationRetries: number;
}

const DEFAULT_CONFIG: MigrationAgentConfig = {
  pollIntervalMs: 5000,
  shutdownTimeoutMs: 60000,
  freshnessThreshold: 0.8,
  maxValidationRetries: 2,
};

// =============================================================================
// Default agent instructions
// =============================================================================

const DEFAULT_AGENT_INSTRUCTIONS = `You are a dependency upgrade assistant. Follow these guidelines:
- Make minimal, conservative changes to upgrade the specified dependencies.
- Update version numbers in ALL manifest files that contain the targeted dependencies (package.json, requirements.txt, pyproject.toml, pom.xml, build.gradle, Cargo.toml, go.mod, Gemfile, etc.).
- IMPORTANT: This may be a monorepo with multiple projects in subfolders. You MUST update every manifest file provided in the Manifest Contents section that contains any of the targeted dependencies.
- IMPORTANT: Review the Source Files section for any usage of deprecated or removed APIs from the upgraded dependencies. Update these files to use the new API equivalents.
- For Angular upgrades: check for deprecated modules, renamed exports, changed method signatures, removed APIs, and updated import paths.
- For Python upgrades: check for deprecated function calls, renamed modules, changed parameter names, and removed features.
- Update import paths if the dependency has breaking API changes.
- Update test dependencies alongside production dependencies.
- Preserve existing code style and formatting conventions.
- Do not add new dependencies unless required by the upgrade.
- Do not remove existing functionality.
- NEVER modify or generate lock files (package-lock.json, yarn.lock, Pipfile.lock, Cargo.lock, poetry.lock, Gemfile.lock). These are auto-generated and must not be included in your response.
- The filePath in your response must match the exact path shown in the Manifest Contents or Source Files sections (e.g., "angular-app/package.json", "angular-app/src/app/app.module.ts").`;

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

  const maxValidationRetries = env.MIGRATION_MAX_VALIDATION_RETRIES
    ? parseInt(env.MIGRATION_MAX_VALIDATION_RETRIES, 10)
    : DEFAULT_CONFIG.maxValidationRetries;

  return {
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : DEFAULT_CONFIG.pollIntervalMs,
    shutdownTimeoutMs: Number.isFinite(shutdownTimeoutMs) ? shutdownTimeoutMs : DEFAULT_CONFIG.shutdownTimeoutMs,
    dashboardBaseUrl: env.DASHBOARD_BASE_URL,
    freshnessThreshold: Number.isFinite(freshnessThreshold) ? freshnessThreshold : DEFAULT_CONFIG.freshnessThreshold,
    maxValidationRetries: Number.isFinite(maxValidationRetries) ? maxValidationRetries : DEFAULT_CONFIG.maxValidationRetries,
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
    console.log(`[MigrationAgent] Processing job ${job.migrationId} for repository ${job.repositoryId}`);
    try {
      // 1. Get GitHub token
      const token = await this.tokenService.getToken('github');
      if (!token) {
        console.log(`[MigrationAgent] Job ${job.migrationId}: no GitHub token configured`);
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
        console.log(`[MigrationAgent] Job ${job.migrationId}: repository not found`);
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
      console.log(`[MigrationAgent] Job ${job.migrationId}: repo=${owner}/${repo}`);

      // 4. Load repository context — fetch manifest files from GitHub
      const metadata = await this.db.getRepositoryMetadata(job.repositoryId);
      const storedFileTree = await this.db.getFileTree(job.repositoryId);
      console.log(`[MigrationAgent] Job ${job.migrationId}: stored file tree has ${storedFileTree.length} entries`);
      const fileTree: FileEntry[] = [];
      const manifestContents: Record<string, string> = {};

      // Populate file tree from stored metadata
      if (metadata?.dependencies) {
        // Build a set of likely manifest files based on ecosystems
        const manifestPaths = this.getManifestPaths(metadata.dependencies, storedFileTree);
        console.log(`[MigrationAgent] Job ${job.migrationId}: manifest paths to fetch: ${JSON.stringify(manifestPaths)}`);
        for (const manifestPath of manifestPaths) {
          try {
            const content = await this.githubService.getFileContent({
              owner, repo, token, path: manifestPath,
            });
            if (content) {
              manifestContents[manifestPath] = content;
              fileTree.push({ path: manifestPath, type: 'file' });
            }
          } catch {
            console.log(`[MigrationAgent] Job ${job.migrationId}: failed to fetch ${manifestPath}`);
          }
        }
        console.log(`[MigrationAgent] Job ${job.migrationId}: fetched ${Object.keys(manifestContents).length} manifest files`);
      } else {
        console.log(`[MigrationAgent] Job ${job.migrationId}: no metadata dependencies found`);
      }

      // 4b. Fetch source files that may need updates
      const manifestPaths = Object.keys(manifestContents);
      const sourceFilePaths = this.getSourceFilePaths(manifestPaths, storedFileTree);
      const sourceContents: Record<string, string> = {};
      let totalSourceSize = 0;
      const MAX_TOTAL_SOURCE_SIZE = 100_000; // 100KB total cap for source files

      for (const sourcePath of sourceFilePaths) {
        if (totalSourceSize >= MAX_TOTAL_SOURCE_SIZE) break;
        try {
          const content = await this.githubService.getFileContent({
            owner, repo, token, path: sourcePath,
          });
          if (content && content.length <= 30_000) {
            sourceContents[sourcePath] = content;
            totalSourceSize += content.length;
          }
        } catch {
          // Skip files that can't be fetched
        }
      }
      console.log(`[MigrationAgent] Job ${job.migrationId}: fetched ${Object.keys(sourceContents).length} source files (${Math.round(totalSourceSize / 1024)}KB)`);

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
      console.log(`[MigrationAgent] Job ${job.migrationId}: ${upgradeTargets.length} upgrade targets`);

      if (upgradeTargets.length === 0) {
        console.log(`[MigrationAgent] Job ${job.migrationId}: no upgrade targets, marking completed`);
        await this.db.updateMigrationStatus(
          job.migrationId,
          'completed',
          'No dependencies to upgrade.',
        );
        return;
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
          fileTree: storedFileTree.length > 0 ? storedFileTree : fileTree,
          manifestContents,
          sourceContents,
          repoName: repository.name,
        },
      };

      console.log(`[MigrationAgent] Job ${job.migrationId}: calling AI provider with ${Object.keys(manifestContents).length} manifests, ${request.repositoryContext.fileTree.length} file tree entries`);
      let aiResponse = await this.aiProvider.generateChanges(request);
      console.log(`[MigrationAgent] Job ${job.migrationId}: AI returned ${aiResponse.fileChanges.length} file changes, ${aiResponse.errors.length} errors`);

      if (aiResponse.errors.length > 0) {
        console.log(`[MigrationAgent] Job ${job.migrationId}: AI errors: ${JSON.stringify(aiResponse.errors)}`);
      }

      // 8. Validation loop — ask AI to analyze and fix errors
      if (aiResponse.fileChanges.length > 0 && this.aiProvider.validateAndFix) {
        let currentChanges = aiResponse.fileChanges;

        for (let attempt = 0; attempt < this.config.maxValidationRetries; attempt++) {
          const errors = await this.analyzeChanges(currentChanges, request.repositoryContext);
          if (!errors) break;

          console.log(`[MigrationAgent] Job ${job.migrationId}: validation attempt ${attempt + 1} found errors, requesting fix`);

          const validationRequest: ValidationRequest = {
            fileChanges: currentChanges,
            errors,
            repositoryContext: request.repositoryContext,
            upgradeTargets,
          };

          const fixResponse = await this.aiProvider.validateAndFix(validationRequest);
          if (fixResponse.fileChanges.length > 0) {
            currentChanges = fixResponse.fileChanges;
            aiResponse = { ...aiResponse, fileChanges: currentChanges, prDescription: fixResponse.prDescription || aiResponse.prDescription };
          } else {
            break;
          }
        }
      }

      // 9. If file changes were produced, create branch, commit, open PR
      if (aiResponse.fileChanges.length > 0) {
        const rawDescription = upgradeTargets.map((t) => t.dependencyName).join('-');
        // Keep branch name short — use first 3 dependency names max, cap at 80 chars
        const shortDesc = upgradeTargets.slice(0, 3).map((t) => t.dependencyName).join('-');
        const suffix = upgradeTargets.length > 3 ? `-and-${upgradeTargets.length - 3}-more` : '';
        const description = (shortDesc + suffix).substring(0, 80);
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

        const MAX_LISTED_DEPS = 3;
        const depNames = upgradeTargets.map((t) => t.dependencyName);
        const listed = depNames.slice(0, MAX_LISTED_DEPS).join(', ');
        const prTitle =
          depNames.length <= MAX_LISTED_DEPS
            ? `[Migration Agent] Upgrade ${listed}`
            : `[Migration Agent] Upgrade ${listed} and ${depNames.length - MAX_LISTED_DEPS} more`;
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
        console.log(`[MigrationAgent] Job ${job.migrationId}: PR created at ${prUrl}`);
      } else {
        // No file changes — mark completed with note
        console.log(`[MigrationAgent] Job ${job.migrationId}: AI returned 0 file changes, nothing to commit`);
        await this.db.updateMigrationStatus(
          job.migrationId,
          'completed',
          'No file changes generated by AI provider.',
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MigrationAgent] Job ${job.migrationId} failed: ${errorMessage}`);
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

  /**
   * Ask the AI to analyze the proposed file changes for potential build/lint errors.
   * Returns the error description string if issues are found, or null if clean.
   */
  private async analyzeChanges(
    fileChanges: FileChange[],
    repositoryContext: AIProviderRequest['repositoryContext'],
  ): Promise<string | null> {
    const analysisRequest: AIProviderRequest = {
      upgradeTargets: [],
      agentInstructions: `You are a code reviewer. Analyze the following file changes for potential errors:
- TypeScript/JavaScript type errors or incompatibilities
- Breaking API changes from dependency upgrades
- Missing imports or incorrect import paths
- Version constraint conflicts between dependencies
- Angular-specific issues (module changes, deprecated APIs, renamed exports)

If you find errors, respond with ONLY a JSON block:
\`\`\`json
{ "hasErrors": true, "errors": "description of all errors found" }
\`\`\`

If the changes look correct, respond with:
\`\`\`json
{ "hasErrors": false, "errors": "" }
\`\`\``,
      repositoryContext,
    };

    try {
      const response = await this.aiProvider.generateChanges(analysisRequest);
      // Check if the AI found errors in its response
      const rawDescription = response.prDescription || '';
      const errorMatch = rawDescription.match(/"hasErrors"\s*:\s*true/);
      if (errorMatch) {
        const errorsMatch = rawDescription.match(/"errors"\s*:\s*"([^"]+)"/);
        return errorsMatch?.[1] ?? 'Unknown errors detected in file changes';
      }

      // Also check if the response itself contains error indicators
      if (response.errors.length > 0) {
        return response.errors.map((e) => `${e.dependencyName}: ${e.error}`).join('\n');
      }

      return null;
    } catch {
      // If analysis fails, skip validation and proceed
      return null;
    }
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

  /**
   * Determine which manifest files to fetch based on the ecosystems
   * present in the repository's dependencies.
   */
  private getManifestPaths(
      dependencies: Array<{ ecosystem: string }>,
      storedFileTree: FileEntry[],
    ): string[] {
      const ecosystems = new Set(dependencies.map((d) => d.ecosystem));
      const manifestFilenames = new Set<string>();

      if (ecosystems.has('npm'))    { manifestFilenames.add('package.json'); }
      if (ecosystems.has('pip'))    { manifestFilenames.add('requirements.txt'); manifestFilenames.add('pyproject.toml'); }
      if (ecosystems.has('maven'))  { manifestFilenames.add('pom.xml'); }
      if (ecosystems.has('gradle')) { manifestFilenames.add('build.gradle'); manifestFilenames.add('build.gradle.kts'); }
      if (ecosystems.has('cargo'))  { manifestFilenames.add('Cargo.toml'); }
      if (ecosystems.has('go'))     { manifestFilenames.add('go.mod'); }
      if (ecosystems.has('gem'))    { manifestFilenames.add('Gemfile'); }

      // Always try package.json as a fallback
      if (manifestFilenames.size === 0) manifestFilenames.add('package.json');

      // If we have a stored file tree, search for manifest files at any depth
      if (storedFileTree.length > 0) {
        const matched = storedFileTree
          .filter((entry) => entry.type === 'file')
          .filter((entry) => {
            const basename = entry.path.split('/').pop() ?? '';
            return manifestFilenames.has(basename);
          })
          .map((entry) => entry.path);

        if (matched.length > 0) return matched;
      }

      // Fallback to root-level paths if no file tree is available
      return Array.from(manifestFilenames);
    }

  /**
   * Identify source files that may need updates when dependencies change.
   * Looks for source files in the same project directories as the manifest files,
   * filtered to extensions relevant to each ecosystem.
   */
  private getSourceFilePaths(
      manifestPaths: string[],
      storedFileTree: FileEntry[],
      maxFiles: number = 15,
    ): string[] {
      if (storedFileTree.length === 0) return [];

      // Map ecosystem extensions to the directories containing their manifests
      const ecosystemExtensions: Record<string, string[]> = {
        'package.json': ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
        'package-lock.json': [],
        'requirements.txt': ['.py'],
        'pyproject.toml': ['.py'],
        'pom.xml': ['.java', '.kt'],
        'build.gradle': ['.java', '.kt'],
        'build.gradle.kts': ['.java', '.kt'],
        'Cargo.toml': ['.rs'],
        'go.mod': ['.go'],
        'Gemfile': ['.rb'],
      };

      // Collect project directories and their relevant extensions
      const projectDirs: Array<{ dir: string; extensions: string[] }> = [];
      for (const manifestPath of manifestPaths) {
        const lastSlash = manifestPath.lastIndexOf('/');
        const dir = lastSlash >= 0 ? manifestPath.substring(0, lastSlash) : '';
        const basename = manifestPath.split('/').pop() ?? '';
        const extensions = ecosystemExtensions[basename] ?? [];
        if (extensions.length > 0) {
          projectDirs.push({ dir, extensions });
        }
      }

      if (projectDirs.length === 0) return [];

      // Ignore common non-source directories and test/spec files
      const ignoreDirs = ['node_modules', 'dist', 'build', '.git', '__pycache__', '.venv', 'venv', 'target', 'vendor', 'coverage', '.angular'];
      const ignorePatterns = ['.spec.', '.test.', '.e2e.', '__test__'];

      const sourceFiles = storedFileTree
        .filter((entry) => entry.type === 'file')
        .filter((entry) => {
          // Skip large files (> 50KB)
          if (entry.size && entry.size > 50_000) return false;

          // Skip test files
          if (ignorePatterns.some((p) => entry.path.includes(p))) return false;

          return projectDirs.some(({ dir, extensions }) => {
            const inDir = dir === '' ? true : entry.path.startsWith(dir + '/');
            if (!inDir) return false;

            const ext = entry.path.substring(entry.path.lastIndexOf('.'));
            if (!extensions.includes(ext)) return false;

            const parts = entry.path.split('/');
            return !parts.some((p) => ignoreDirs.includes(p));
          });
        })
        .map((entry) => entry.path);

      return sourceFiles.slice(0, maxFiles);
    }
}

// Import the static method from GitHubService
import { GitHubService as GitHubServiceStatic } from './GitHubService';
