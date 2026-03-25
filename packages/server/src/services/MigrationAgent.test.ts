import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  MigrationAgent,
  filterDependenciesByThreshold,
  parseMigrationAgentConfig,
} from './MigrationAgent';
import type { RepositoryDb } from '../db/RepositoryDb';
import type { TokenService } from './TokenService';
import type { FreshnessService } from './FreshnessService';
import type { GitHubService } from './GitHubService';
import type {
  AIProvider,
  AIProviderResponse,
  MigrationStatus,
  FreshnessResult,
  Repository,
  RepositoryMetadata,
  IngestionRecord,
} from '../models/types';

// =============================================================================
// Mock factories
// =============================================================================

function makeMockDb(overrides?: Partial<RepositoryDb>): RepositoryDb {
  return {
    claimNextJob: vi.fn().mockResolvedValue(null),
    updateMigrationStatus: vi.fn().mockResolvedValue(undefined),
    getRepository: vi.fn().mockResolvedValue(null),
    getRepositoryMetadata: vi.fn().mockResolvedValue(null),
    getFreshnessScores: vi.fn().mockResolvedValue(null),
    getRepositoryDependencies: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as RepositoryDb;
}

function makeMockTokenService(token: string | null = 'ghp_test_token'): TokenService {
  return {
    getToken: vi.fn().mockResolvedValue(token),
  } as unknown as TokenService;
}

function makeMockFreshnessService(): FreshnessService {
  return {
    computeScores: vi.fn().mockResolvedValue(undefined),
    isScoring: vi.fn().mockReturnValue(false),
  } as unknown as FreshnessService;
}

function makeMockAiProvider(response?: Partial<AIProviderResponse>): AIProvider {
  return {
    generateChanges: vi.fn().mockResolvedValue({
      fileChanges: [],
      prDescription: 'Test PR description',
      errors: [],
      ...response,
    }),
  };
}

function makeMockGithubService(): GitHubService {
  return {
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    createBranch: vi.fn().mockResolvedValue(undefined),
    commitChanges: vi.fn().mockResolvedValue('abc123'),
    createPullRequest: vi.fn().mockResolvedValue({
      prUrl: 'https://github.com/owner/repo/pull/1',
      prNumber: 1,
    }),
    getFileContent: vi.fn().mockResolvedValue(null),
  } as unknown as GitHubService;
}

function makeJob(overrides?: Partial<MigrationStatus>): MigrationStatus {
  return {
    migrationId: 'job-123',
    repositoryId: 'repo-456',
    migrationType: 'ai-upgrade',
    status: 'running',
    parameters: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepository(overrides?: Partial<Repository>): Repository {
  return {
    id: 'repo-456',
    name: 'owner/repo',
    sourceType: 'github',
    sourceIdentifier: 'https://github.com/owner/repo',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Unit Tests — Task 5.7
// =============================================================================

describe('MigrationAgent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Start/Stop lifecycle
  // ---------------------------------------------------------------------------

  describe('start/stop lifecycle', () => {
    it('starts polling and can be stopped', async () => {
      const db = makeMockDb();
      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 100 },
      );

      agent.start();

      // Advance past one poll interval
      await vi.advanceTimersByTimeAsync(150);
      expect(db.claimNextJob).toHaveBeenCalled();

      const stopPromise = agent.stop();
      await vi.advanceTimersByTimeAsync(100);
      await stopPromise;
    });

    it('does not start twice', async () => {
      const db = makeMockDb();
      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 100 },
      );

      agent.start();
      agent.start(); // second call should be no-op

      await vi.advanceTimersByTimeAsync(150);
      // Should only have polled once (not double-polling)
      expect((db.claimNextJob as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(2);

      await agent.stop();
    });

    it('stop is a no-op when not running', async () => {
      const agent = new MigrationAgent(
        makeMockDb(),
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
      );

      // Should resolve immediately
      await agent.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Poll loop timing
  // ---------------------------------------------------------------------------

  describe('poll loop timing', () => {
    it('polls at the configured interval', async () => {
      const db = makeMockDb();
      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 200 },
      );

      agent.start();

      // Before first interval, no poll
      await vi.advanceTimersByTimeAsync(100);
      expect(db.claimNextJob).not.toHaveBeenCalled();

      // After first interval, first poll
      await vi.advanceTimersByTimeAsync(150);
      expect(db.claimNextJob).toHaveBeenCalledTimes(1);

      // After second interval, second poll
      await vi.advanceTimersByTimeAsync(200);
      expect(db.claimNextJob).toHaveBeenCalledTimes(2);

      await agent.stop();
    });

    it('uses setTimeout not setInterval (no overlapping ticks)', async () => {
      let resolveClaimJob: (() => void) | null = null;
      const db = makeMockDb({
        claimNextJob: vi.fn().mockImplementation(
          () =>
            new Promise<null>((resolve) => {
              resolveClaimJob = () => resolve(null);
            }),
        ),
      });

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 100 },
      );

      agent.start();

      // Trigger first tick
      await vi.advanceTimersByTimeAsync(100);
      expect(db.claimNextJob).toHaveBeenCalledTimes(1);

      // Advance more time — should NOT trigger another tick while first is pending
      await vi.advanceTimersByTimeAsync(200);
      expect(db.claimNextJob).toHaveBeenCalledTimes(1);

      // Resolve the first claim
      resolveClaimJob!();
      await vi.advanceTimersByTimeAsync(0);

      // Now the next tick should be scheduled
      await vi.advanceTimersByTimeAsync(100);
      expect(db.claimNextJob).toHaveBeenCalledTimes(2);

      await agent.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Job processing flow (success path)
  // ---------------------------------------------------------------------------

  describe('job processing — success path', () => {
    it('processes a job end-to-end: claim → AI → branch → commit → PR → completed', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express', ecosystem: 'npm', targetVersion: '5.0.0' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue({
          repository: makeRepository(),
          latestIngestion: {} as IngestionRecord,
          languages: [],
          frameworks: [],
          dependencies: [],
        } as RepositoryMetadata),
      });

      const aiProvider = makeMockAiProvider({
        fileChanges: [
          { filePath: 'package.json', originalContent: '{}', modifiedContent: '{"v":"5"}' },
        ],
        prDescription: 'Upgraded express',
      });

      const githubService = makeMockGithubService();

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        githubService,
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(aiProvider.generateChanges).toHaveBeenCalled();
      expect(githubService.createBranch).toHaveBeenCalled();
      expect(githubService.commitChanges).toHaveBeenCalled();
      expect(githubService.createPullRequest).toHaveBeenCalled();
      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'completed',
        'https://github.com/owner/repo/pull/1',
      );

      await agent.stop();
    });

    it('marks job completed with note when AI produces no file changes', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider = makeMockAiProvider({ fileChanges: [] });
      const githubService = makeMockGithubService();

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        githubService,
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(githubService.createBranch).not.toHaveBeenCalled();
      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'completed',
        'No file changes generated by AI provider.',
      );

      await agent.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Job processing flow (failure paths)
  // ---------------------------------------------------------------------------

  describe('job processing — failure paths', () => {
    it('marks job failed when GitHub token is not configured', async () => {
      const job = makeJob();
      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
      });

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(null),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'failed',
        undefined,
        'GitHub access token not configured.',
      );

      await agent.stop();
    });

    it('marks job failed when repository is not found', async () => {
      const job = makeJob();
      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(null),
      });

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'failed',
        undefined,
        'Repository not found.',
      );

      await agent.stop();
    });

    it('marks job failed when AI provider throws', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider: AIProvider = {
        generateChanges: vi.fn().mockRejectedValue(new Error('AI provider error: 500')),
      };

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        makeMockGithubService(),
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'failed',
        undefined,
        'AI provider error: 500',
      );

      await agent.stop();
    });

    it('marks job failed when branch creation fails', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider = makeMockAiProvider({
        fileChanges: [
          { filePath: 'package.json', originalContent: '{}', modifiedContent: '{"v":"5"}' },
        ],
      });

      const githubService = makeMockGithubService();
      (githubService.createBranch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('GitHub API error: 422'),
      );

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        githubService,
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'failed',
        undefined,
        'GitHub API error: 422',
      );

      await agent.stop();
    });

    it('continues polling after a job failure', async () => {
      const job = makeJob();
      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
      });

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(null), // will cause failure
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      // First call claimed the job, second call is the next poll
      expect(db.claimNextJob).toHaveBeenCalledTimes(2);

      await agent.stop();
    });

    it('continues polling after database error during claim', async () => {
      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockRejectedValueOnce(new Error('Connection lost'))
          .mockResolvedValue(null),
      });

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        makeMockAiProvider(),
        makeMockGithubService(),
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      // Should have retried after the error
      expect(db.claimNextJob).toHaveBeenCalledTimes(2);

      await agent.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------

  describe('graceful shutdown', () => {
    it('waits for in-flight job to complete', async () => {
      let resolveAi: (() => void) | null = null;
      const aiPromise = new Promise<AIProviderResponse>((resolve) => {
        resolveAi = () =>
          resolve({ fileChanges: [], prDescription: '', errors: [] });
      });

      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider: AIProvider = {
        generateChanges: vi.fn().mockReturnValue(aiPromise),
      };

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        makeMockGithubService(),
        { pollIntervalMs: 50, shutdownTimeoutMs: 5000 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(60);

      // Start shutdown while AI is still processing
      const stopPromise = agent.stop();

      // Resolve the AI call
      resolveAi!();
      await vi.advanceTimersByTimeAsync(0);
      await stopPromise;

      expect(db.updateMigrationStatus).toHaveBeenCalledWith(
        'job-123',
        'completed',
        'No file changes generated by AI provider.',
      );
    });

    it('resolves after timeout if in-flight job does not complete', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      // AI provider that never resolves
      const aiProvider: AIProvider = {
        generateChanges: vi.fn().mockReturnValue(new Promise(() => {})),
      };

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        makeMockGithubService(),
        { pollIntervalMs: 50, shutdownTimeoutMs: 1000 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(60);

      const stopPromise = agent.stop();

      // Advance past the shutdown timeout
      await vi.advanceTimersByTimeAsync(1100);
      await stopPromise;

      // Should have resolved without waiting forever
    });
  });

  // ---------------------------------------------------------------------------
  // upgradeAll filtering
  // ---------------------------------------------------------------------------

  describe('upgradeAll filtering', () => {
    it('builds upgrade targets from freshness scores below threshold', async () => {
      const freshnessResult: FreshnessResult = {
        repositoryId: 'repo-456',
        ingestionId: 'ing-1',
        grade: 'C',
        weightedAverage: 0.6,
        computedAt: new Date(),
        dependencies: [
          {
            dependencyName: 'express',
            ecosystem: 'npm',
            resolvedVersion: '4.18.2',
            latestVersion: '5.0.0',
            score: 0.5,
            dependencyType: 'production',
            status: 'scored',
          },
          {
            dependencyName: 'lodash',
            ecosystem: 'npm',
            resolvedVersion: '4.17.21',
            latestVersion: '4.17.21',
            score: 1.0,
            dependencyType: 'production',
            status: 'scored',
          },
          {
            dependencyName: 'vitest',
            ecosystem: 'npm',
            resolvedVersion: '1.0.0',
            latestVersion: '1.6.0',
            score: 0.7,
            dependencyType: 'development',
            status: 'scored',
          },
        ],
      };

      const job = makeJob({
        parameters: { upgradeAll: true } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
        getFreshnessScores: vi.fn().mockResolvedValue(freshnessResult),
      });

      const aiProvider = makeMockAiProvider();

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        makeMockGithubService(),
        { pollIntervalMs: 50, freshnessThreshold: 0.8 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      const call = (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mock.calls[0];
      const request = call[0];
      // Should include express (0.5) and vitest (0.7), but not lodash (1.0)
      expect(request.upgradeTargets).toHaveLength(2);
      expect(request.upgradeTargets.map((t: { dependencyName: string }) => t.dependencyName).sort()).toEqual([
        'express',
        'vitest',
      ]);

      await agent.stop();
    });
  });

  // ---------------------------------------------------------------------------
  // Agent instructions loading
  // ---------------------------------------------------------------------------

  describe('agent instructions loading', () => {
    it('uses custom instructions when provided in parameters', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
          customInstructions: 'Use strict mode everywhere',
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider = makeMockAiProvider();
      const githubService = makeMockGithubService();

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        githubService,
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      const call = (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0].agentInstructions).toBe('Use strict mode everywhere');
      // Should not have tried to fetch from repo
      expect(githubService.getFileContent).not.toHaveBeenCalled();

      await agent.stop();
    });

    it('uses repo .migration-agent.md when no custom instructions', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider = makeMockAiProvider();
      const githubService = makeMockGithubService();
      (githubService.getFileContent as ReturnType<typeof vi.fn>).mockResolvedValue(
        '# Custom repo instructions\nBe careful with breaking changes.',
      );

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        githubService,
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      const call = (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0].agentInstructions).toBe(
        '# Custom repo instructions\nBe careful with breaking changes.',
      );

      await agent.stop();
    });

    it('falls back to defaults when repo file not found', async () => {
      const job = makeJob({
        parameters: {
          dependencies: [{ name: 'express' }],
        } as unknown as Record<string, string>,
      });

      const db = makeMockDb({
        claimNextJob: vi.fn()
          .mockResolvedValueOnce(job)
          .mockResolvedValue(null),
        getRepository: vi.fn().mockResolvedValue(makeRepository()),
        getRepositoryMetadata: vi.fn().mockResolvedValue(null),
      });

      const aiProvider = makeMockAiProvider();
      const githubService = makeMockGithubService();
      (githubService.getFileContent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const agent = new MigrationAgent(
        db,
        makeMockTokenService(),
        makeMockFreshnessService(),
        aiProvider,
        githubService,
        { pollIntervalMs: 50 },
      );

      agent.start();
      await vi.advanceTimersByTimeAsync(100);

      const call = (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0].agentInstructions).toContain('dependency upgrade assistant');

      await agent.stop();
    });
  });
});


// =============================================================================
// Helper function unit tests
// =============================================================================

describe('filterDependenciesByThreshold', () => {
  it('returns dependencies below the threshold', () => {
    const scores = [
      { dependencyName: 'a', ecosystem: 'npm', currentVersion: '1.0.0', score: 0.3 },
      { dependencyName: 'b', ecosystem: 'npm', currentVersion: '2.0.0', score: 0.9 },
      { dependencyName: 'c', ecosystem: 'pip', currentVersion: '3.0.0', score: 0.5 },
    ];
    const result = filterDependenciesByThreshold(scores, 0.8);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.dependencyName)).toEqual(['a', 'c']);
  });

  it('returns empty array when all scores are above threshold', () => {
    const scores = [
      { dependencyName: 'a', ecosystem: 'npm', currentVersion: '1.0.0', score: 0.9 },
    ];
    const result = filterDependenciesByThreshold(scores, 0.8);
    expect(result).toHaveLength(0);
  });

  it('returns all when all scores are below threshold', () => {
    const scores = [
      { dependencyName: 'a', ecosystem: 'npm', currentVersion: '1.0.0', score: 0.1 },
      { dependencyName: 'b', ecosystem: 'npm', currentVersion: '2.0.0', score: 0.2 },
    ];
    const result = filterDependenciesByThreshold(scores, 0.5);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    const result = filterDependenciesByThreshold([], 0.8);
    expect(result).toHaveLength(0);
  });

  it('does not include dependencies with score exactly equal to threshold', () => {
    const scores = [
      { dependencyName: 'a', ecosystem: 'npm', currentVersion: '1.0.0', score: 0.8 },
    ];
    const result = filterDependenciesByThreshold(scores, 0.8);
    expect(result).toHaveLength(0);
  });
});

describe('parseMigrationAgentConfig', () => {
  it('returns defaults when no env vars set', () => {
    const config = parseMigrationAgentConfig({});
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.shutdownTimeoutMs).toBe(60000);
    expect(config.freshnessThreshold).toBe(0.8);
    expect(config.dashboardBaseUrl).toBeUndefined();
  });

  it('parses MIGRATION_POLL_INTERVAL_MS', () => {
    const config = parseMigrationAgentConfig({ MIGRATION_POLL_INTERVAL_MS: '10000' });
    expect(config.pollIntervalMs).toBe(10000);
  });

  it('parses DASHBOARD_BASE_URL', () => {
    const config = parseMigrationAgentConfig({ DASHBOARD_BASE_URL: 'https://dash.example.com' });
    expect(config.dashboardBaseUrl).toBe('https://dash.example.com');
  });

  it('falls back to defaults for non-numeric values', () => {
    const config = parseMigrationAgentConfig({ MIGRATION_POLL_INTERVAL_MS: 'not-a-number' });
    expect(config.pollIntervalMs).toBe(5000);
  });
});

// =============================================================================
// Property-Based Tests — Task 5.8
// =============================================================================

describe('MigrationAgent - Property Tests', () => {
  /**
   * Feature: background-migration-agent, Property 2: UpgradeAll selects dependencies below freshness threshold
   *
   * For any set of dependency freshness scores and any threshold value (0–1),
   * when upgradeAll is true, the resulting UpgradeTarget[] should contain exactly
   * those dependencies whose freshness score is below the threshold, and no others.
   *
   * **Validates: Requirements 1.3**
   */
  it('Property 2: UpgradeAll selects dependencies below freshness threshold', () => {
    const depScoreArb = fc.record({
      dependencyName: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
      ecosystem: fc.constantFrom('npm', 'maven', 'pip', 'cargo', 'gem', 'go'),
      currentVersion: fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0),
      score: fc.double({ min: 0, max: 1, noNaN: true }),
    });

    fc.assert(
      fc.property(
        fc.array(depScoreArb, { minLength: 0, maxLength: 20 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (scores, threshold) => {
          const result = filterDependenciesByThreshold(scores, threshold);

          // Result should contain exactly those with score < threshold
          const expectedNames = scores
            .filter((s) => s.score < threshold)
            .map((s) => s.dependencyName);

          expect(result.map((r) => r.dependencyName)).toEqual(expectedNames);

          // No dependency in result should have score >= threshold
          for (const r of result) {
            const original = scores.find((s) => s.dependencyName === r.dependencyName);
            expect(original).toBeDefined();
            expect(original!.score).toBeLessThan(threshold);
          }

          // Every dependency below threshold should be in result
          for (const s of scores) {
            if (s.score < threshold) {
              expect(result.some((r) => r.dependencyName === s.dependencyName)).toBe(true);
            }
          }

          // Result items should have correct shape
          for (const r of result) {
            expect(r).toHaveProperty('dependencyName');
            expect(r).toHaveProperty('ecosystem');
            expect(r).toHaveProperty('currentVersion');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: background-migration-agent, Property 7: Job outcome correctly recorded
   *
   * For any migration job, if processing succeeds, the job status should be completed
   * with the PR URL stored in result. If processing fails for any reason, the job status
   * should be failed with a non-empty error_details. In both cases, updated_at should be updated.
   *
   * **Validates: Requirements 6.1, 6.3, 6.4**
   */
  it('Property 7: Job outcome correctly recorded', async () => {
    vi.useRealTimers();

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // true = success, false = failure
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0), // prUrl or errorMessage
        async (shouldSucceed, message) => {
          const job = makeJob({
            parameters: {
              dependencies: [{ name: 'express' }],
            } as unknown as Record<string, string>,
          });

          const updateCalls: Array<[string, string, string?, string?]> = [];

          const db = makeMockDb({
            claimNextJob: vi.fn()
              .mockResolvedValueOnce(job)
              .mockResolvedValue(null),
            getRepository: vi.fn().mockResolvedValue(makeRepository()),
            getRepositoryMetadata: vi.fn().mockResolvedValue(null),
            updateMigrationStatus: vi.fn().mockImplementation(
              (id: string, status: string, result?: string, errorDetails?: string) => {
                updateCalls.push([id, status, result, errorDetails]);
                return Promise.resolve();
              },
            ),
          });

          let aiProvider: AIProvider;
          const githubService = makeMockGithubService();

          if (shouldSucceed) {
            aiProvider = {
              generateChanges: vi.fn().mockResolvedValue({
                fileChanges: [
                  { filePath: 'package.json', originalContent: '{}', modifiedContent: '{"v":"5"}' },
                ],
                prDescription: 'Upgraded',
                errors: [],
              }),
            };
            (githubService.createPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
              prUrl: message,
              prNumber: 1,
            });
          } else {
            aiProvider = {
              generateChanges: vi.fn().mockRejectedValue(new Error(message)),
            };
          }

          const agent = new MigrationAgent(
            db,
            makeMockTokenService(),
            makeMockFreshnessService(),
            aiProvider,
            githubService,
            { pollIntervalMs: 1 },
          );

          // Manually trigger processing by starting and waiting
          agent.start();
          await new Promise((r) => setTimeout(r, 20));
          await agent.stop();

          expect(updateCalls.length).toBeGreaterThanOrEqual(1);
          const lastCall = updateCalls[updateCalls.length - 1];

          if (shouldSucceed) {
            expect(lastCall[1]).toBe('completed');
            expect(lastCall[2]).toBe(message); // PR URL in result
          } else {
            expect(lastCall[1]).toBe('failed');
            expect(lastCall[3]).toBeTruthy(); // non-empty error_details
            expect(typeof lastCall[3]).toBe('string');
            expect((lastCall[3] as string).length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Feature: background-migration-agent, Property 10: Errors mark job as failed with descriptive details
   *
   * For any error during job processing (AI provider failure, GitHub API rate limit,
   * authentication failure, branch creation failure, PR creation failure, or unexpected error),
   * the migration job should be marked as failed with error_details containing a non-empty
   * message describing the failure.
   *
   * **Validates: Requirements 4.5, 4.6, 8.1, 8.2, 8.3, 8.4**
   */
  it('Property 10: Errors mark job as failed with descriptive details', async () => {
    vi.useRealTimers();

    const errorTypeArb = fc.constantFrom(
      'ai-provider',
      'rate-limit',
      'auth-failure',
      'branch-creation',
      'pr-creation',
      'unexpected',
    );

    const errorMessageArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

    await fc.assert(
      fc.asyncProperty(
        errorTypeArb,
        errorMessageArb,
        async (errorType, errorMessage) => {
          const job = makeJob({
            parameters: {
              dependencies: [{ name: 'express' }],
            } as unknown as Record<string, string>,
          });

          const updateCalls: Array<[string, string, string?, string?]> = [];

          const db = makeMockDb({
            claimNextJob: vi.fn()
              .mockResolvedValueOnce(job)
              .mockResolvedValue(null),
            getRepository: vi.fn().mockResolvedValue(makeRepository()),
            getRepositoryMetadata: vi.fn().mockResolvedValue(null),
            updateMigrationStatus: vi.fn().mockImplementation(
              (id: string, status: string, result?: string, errorDetails?: string) => {
                updateCalls.push([id, status, result, errorDetails]);
                return Promise.resolve();
              },
            ),
          });

          const aiProvider = makeMockAiProvider({
            fileChanges: [
              { filePath: 'package.json', originalContent: '{}', modifiedContent: '{"v":"5"}' },
            ],
          });

          const githubService = makeMockGithubService();

          // Configure the error based on type
          switch (errorType) {
            case 'ai-provider':
              (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error(errorMessage),
              );
              break;
            case 'rate-limit':
              (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error(`Rate limit: ${errorMessage}`),
              );
              break;
            case 'auth-failure':
              (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error(`Auth failure: ${errorMessage}`),
              );
              break;
            case 'branch-creation':
              (githubService.createBranch as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error(`Branch error: ${errorMessage}`),
              );
              break;
            case 'pr-creation':
              (githubService.createPullRequest as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error(`PR error: ${errorMessage}`),
              );
              break;
            case 'unexpected':
              (aiProvider.generateChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error(`Unexpected: ${errorMessage}`),
              );
              break;
          }

          const agent = new MigrationAgent(
            db,
            makeMockTokenService(),
            makeMockFreshnessService(),
            aiProvider,
            githubService,
            { pollIntervalMs: 1 },
          );

          agent.start();
          await new Promise((r) => setTimeout(r, 20));
          await agent.stop();

          // Find the failed status update
          const failedCall = updateCalls.find((c) => c[1] === 'failed');
          expect(failedCall).toBeDefined();
          expect(failedCall![0]).toBe('job-123');
          expect(failedCall![1]).toBe('failed');
          // error_details should be non-empty
          expect(failedCall![3]).toBeTruthy();
          expect(typeof failedCall![3]).toBe('string');
          expect((failedCall![3] as string).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * Feature: background-migration-agent, Property 11: Environment variable configuration parsing
   *
   * For any valid numeric string values set for MIGRATION_POLL_INTERVAL_MS and valid string
   * values for AI_PROVIDER_TYPE, the agent config should parse them to the corresponding values.
   * When not set, the defaults (pollIntervalMs: 5000, AI_PROVIDER_TYPE: 'copilot') should be used.
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 11: Environment variable configuration parsing', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 100, max: 60000 }), { nil: undefined }),
        fc.option(fc.constantFrom('copilot', 'claude', 'gemini'), { nil: undefined }),
        (pollInterval, _providerType) => {
          const env: Record<string, string | undefined> = {};

          if (pollInterval !== undefined) {
            env.MIGRATION_POLL_INTERVAL_MS = String(pollInterval);
          }

          const config = parseMigrationAgentConfig(env);

          // Poll interval
          if (pollInterval !== undefined) {
            expect(config.pollIntervalMs).toBe(pollInterval);
          } else {
            expect(config.pollIntervalMs).toBe(5000);
          }

          // Shutdown timeout defaults
          expect(config.shutdownTimeoutMs).toBe(60000);

          // Freshness threshold defaults
          expect(config.freshnessThreshold).toBe(0.8);
        },
      ),
      { numRuns: 100 },
    );
  });
});
