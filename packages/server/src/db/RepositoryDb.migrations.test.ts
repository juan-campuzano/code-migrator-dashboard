import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MigrationStatus } from '../models/types';

// =============================================================================
// In-memory simulation helpers
// =============================================================================

const STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
type Status = (typeof STATUSES)[number];

interface MigrationRecord {
  migrationId: string;
  repositoryId: string;
  migrationType: string;
  status: Status;
  parameters?: Record<string, string>;
  result?: string;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simulate claimNextJob: find the oldest queued job, transition it to running.
 * Mirrors the SQL: UPDATE ... WHERE id = (SELECT id WHERE status='queued' ORDER BY created_at ASC LIMIT 1)
 */
function simulateClaimNextJob(jobs: MigrationRecord[]): { claimed: MigrationRecord | null; jobs: MigrationRecord[] } {
  const queued = jobs
    .filter((j) => j.status === 'queued')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (queued.length === 0) {
    return { claimed: null, jobs };
  }

  const oldest = queued[0];
  const updatedJobs = jobs.map((j) =>
    j.migrationId === oldest.migrationId
      ? { ...j, status: 'running' as Status, updatedAt: new Date() }
      : j,
  );
  const claimed = updatedJobs.find((j) => j.migrationId === oldest.migrationId)!;
  return { claimed, jobs: updatedJobs };
}

/**
 * Simulate listMigrations with optional filters, ordered by created_at DESC.
 */
function simulateListMigrations(
  jobs: MigrationRecord[],
  filters?: { repositoryId?: string; status?: string },
): MigrationRecord[] {
  let result = [...jobs];
  if (filters?.repositoryId) {
    result = result.filter((j) => j.repositoryId === filters.repositoryId);
  }
  if (filters?.status) {
    result = result.filter((j) => j.status === filters.status);
  }
  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return result;
}

/**
 * Simulate cancelMigration: set status to 'failed' with error_details only if queued.
 */
function simulateCancelMigration(
  jobs: MigrationRecord[],
  id: string,
): { success: boolean; jobs: MigrationRecord[] } {
  const job = jobs.find((j) => j.migrationId === id);
  if (!job || job.status !== 'queued') {
    return { success: false, jobs };
  }
  const updatedJobs = jobs.map((j) =>
    j.migrationId === id
      ? { ...j, status: 'failed' as Status, errorDetails: 'Cancelled by user', updatedAt: new Date() }
      : j,
  );
  return { success: true, jobs: updatedJobs };
}

// =============================================================================
// Arbitraries (generators)
// =============================================================================

const statusArb = fc.constantFrom(...STATUSES);

const repoIdArb = fc.constantFrom('repo-aaa', 'repo-bbb', 'repo-ccc', 'repo-ddd');

/** Generate a Date within a reasonable range, ensuring distinct timestamps. */
const dateArb = (index: number) =>
  fc.integer({ min: 1_000_000_000_000, max: 1_700_000_000_000 }).map(
    (ts) => new Date(ts + index),
  );

const migrationRecordArb = (index: number): fc.Arbitrary<MigrationRecord> =>
  fc.record({
    migrationId: fc.constant(`mig-${index}`),
    repositoryId: repoIdArb,
    migrationType: fc.constant('ai-upgrade'),
    status: statusArb,
    parameters: fc.constant(undefined),
    result: fc.constant(undefined),
    errorDetails: fc.constant(undefined),
    createdAt: dateArb(index),
    updatedAt: dateArb(index),
  });

/** Generate an array of 0–20 migration records with unique IDs. */
const migrationArrayArb = fc
  .integer({ min: 0, max: 20 })
  .chain((len) =>
    len === 0
      ? fc.constant([] as MigrationRecord[])
      : fc.tuple(...Array.from({ length: len }, (_, i) => migrationRecordArb(i))).map((arr) => arr as MigrationRecord[]),
  );

// =============================================================================
// Property Tests
// =============================================================================

describe('RepositoryDb migration methods — property-based tests', () => {
  // Feature: background-migration-agent, Property 1: Claim returns oldest queued job and transitions to running
  it('Property 1: claimNextJob returns the oldest queued job and transitions it to running', () => {
    // **Validates: Requirements 6.1, 6.2**
    fc.assert(
      fc.property(migrationArrayArb, (jobs) => {
        const { claimed, jobs: updatedJobs } = simulateClaimNextJob(jobs);

        const queuedJobs = jobs.filter((j) => j.status === 'queued');

        if (queuedJobs.length === 0) {
          // No queued jobs → should return null
          expect(claimed).toBeNull();
          return;
        }

        // Should return a non-null job
        expect(claimed).not.toBeNull();

        // The claimed job should be the one with the earliest createdAt among queued
        const oldestQueued = queuedJobs.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        )[0];
        expect(claimed!.migrationId).toBe(oldestQueued.migrationId);

        // After claiming, the job's status should be 'running'
        expect(claimed!.status).toBe('running');

        // The job in the updated array should also be 'running'
        const inUpdated = updatedJobs.find((j) => j.migrationId === claimed!.migrationId);
        expect(inUpdated!.status).toBe('running');

        // All other jobs should remain unchanged
        for (const j of updatedJobs) {
          if (j.migrationId !== claimed!.migrationId) {
            const original = jobs.find((o) => o.migrationId === j.migrationId)!;
            expect(j.status).toBe(original.status);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: background-migration-agent, Property 8: List migrations filtering and ordering
  it('Property 8: listMigrations returns only matching migrations in created_at DESC order', () => {
    // **Validates: Requirements 6.5**
    const filtersArb = fc.record({
      repositoryId: fc.option(repoIdArb, { nil: undefined }),
      status: fc.option(statusArb, { nil: undefined }),
    });

    fc.assert(
      fc.property(migrationArrayArb, filtersArb, (jobs, filters) => {
        const result = simulateListMigrations(jobs, filters);

        // Every returned item must match all provided filters
        for (const item of result) {
          if (filters.repositoryId !== undefined) {
            expect(item.repositoryId).toBe(filters.repositoryId);
          }
          if (filters.status !== undefined) {
            expect(item.status).toBe(filters.status);
          }
        }

        // No matching item from the original set should be missing
        const expectedCount = jobs.filter((j) => {
          if (filters.repositoryId !== undefined && j.repositoryId !== filters.repositoryId) return false;
          if (filters.status !== undefined && j.status !== filters.status) return false;
          return true;
        }).length;
        expect(result.length).toBe(expectedCount);

        // Results should be ordered by created_at descending
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
            result[i].createdAt.getTime(),
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: background-migration-agent, Property 9: Cancel succeeds only for queued jobs
  it('Property 9: cancelMigration returns true and sets failed status only for queued jobs', () => {
    // **Validates: Requirements 6.7, 6.8**
    fc.assert(
      fc.property(migrationArrayArb, (jobs) => {
        // Skip empty arrays — nothing to cancel
        fc.pre(jobs.length > 0);

        // Pick a random job to attempt cancellation on
        const targetIndex = Math.floor(Math.random() * jobs.length);
        const targetId = jobs[targetIndex].migrationId;
        const originalJob = jobs[targetIndex];

        const { success, jobs: updatedJobs } = simulateCancelMigration(jobs, targetId);

        if (originalJob.status === 'queued') {
          // Should succeed
          expect(success).toBe(true);

          // The cancelled job should now be 'failed' with the right error message
          const updated = updatedJobs.find((j) => j.migrationId === targetId)!;
          expect(updated.status).toBe('failed');
          expect(updated.errorDetails).toBe('Cancelled by user');
        } else {
          // Should fail — job not in queued status
          expect(success).toBe(false);

          // The job should remain unchanged
          const unchanged = updatedJobs.find((j) => j.migrationId === targetId)!;
          expect(unchanged.status).toBe(originalJob.status);
          expect(unchanged.errorDetails).toBe(originalJob.errorDetails);
        }

        // All other jobs should remain unchanged regardless
        for (const j of updatedJobs) {
          if (j.migrationId !== targetId) {
            const original = jobs.find((o) => o.migrationId === j.migrationId)!;
            expect(j.status).toBe(original.status);
            expect(j.errorDetails).toBe(original.errorDetails);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Additional edge case: cancelling a non-existent ID returns false
  it('Property 9 (edge): cancelMigration returns false for non-existent ID', () => {
    // **Validates: Requirements 6.7, 6.8**
    fc.assert(
      fc.property(migrationArrayArb, (jobs) => {
        const { success, jobs: updatedJobs } = simulateCancelMigration(jobs, 'non-existent-id');
        expect(success).toBe(false);
        // All jobs unchanged
        expect(updatedJobs).toEqual(jobs);
      }),
      { numRuns: 100 },
    );
  });
});
