import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import {
  CopilotProvider,
  resolveAgentInstructions,
  buildPrDescription,
  buildFallbackPrDescription,
} from './AIProvider';
import type { AIProviderRequest, FileChange, UpgradeTarget } from '../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFetch(body: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  })) as unknown as typeof globalThis.fetch;
}

function makeRequest(overrides?: Partial<AIProviderRequest>): AIProviderRequest {
  return {
    upgradeTargets: [
      { dependencyName: 'express', ecosystem: 'npm', currentVersion: '4.18.2', targetVersion: '5.0.0' },
    ],
    agentInstructions: 'Upgrade carefully.',
    repositoryContext: {
      fileTree: [{ path: 'package.json', type: 'file' }],
      manifestContents: { 'package.json': '{"dependencies":{"express":"4.18.2"}}' },
      repoName: 'my-repo',
    },
    ...overrides,
  };
}

const VALID_AI_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          fileChanges: [
            { filePath: 'package.json', originalContent: '{"v":"4"}', modifiedContent: '{"v":"5"}' },
          ],
          prDescription: 'Upgraded express to v5',
          errors: [],
        }),
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Unit Tests (Task 4.4)
// ---------------------------------------------------------------------------

describe('CopilotProvider', () => {
  const config = { apiKey: 'test-key', endpoint: 'https://api.example.com' };

  describe('generateChanges', () => {
    it('sends correct request to the API endpoint', async () => {
      const mockFetch = makeMockFetch(VALID_AI_RESPONSE);
      const provider = new CopilotProvider(config, mockFetch);

      await provider.generateChanges(makeRequest());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/chat/completions');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      });
    });

    it('includes system and user messages in the request body', async () => {
      const mockFetch = makeMockFetch(VALID_AI_RESPONSE);
      const provider = new CopilotProvider(config, mockFetch);

      await provider.generateChanges(makeRequest());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
    });

    it('includes agent instructions in system prompt', async () => {
      const mockFetch = makeMockFetch(VALID_AI_RESPONSE);
      const provider = new CopilotProvider(config, mockFetch);

      await provider.generateChanges(makeRequest({ agentInstructions: 'Custom instructions here' }));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.messages[0].content).toContain('Custom instructions here');
    });

    it('includes repository context in system prompt', async () => {
      const mockFetch = makeMockFetch(VALID_AI_RESPONSE);
      const provider = new CopilotProvider(config, mockFetch);

      await provider.generateChanges(makeRequest());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const systemPrompt = body.messages[0].content;
      expect(systemPrompt).toContain('my-repo');
      expect(systemPrompt).toContain('package.json');
    });

    it('includes upgrade targets in user prompt', async () => {
      const mockFetch = makeMockFetch(VALID_AI_RESPONSE);
      const provider = new CopilotProvider(config, mockFetch);

      await provider.generateChanges(makeRequest());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const userPrompt = body.messages[1].content;
      expect(userPrompt).toContain('express');
      expect(userPrompt).toContain('4.18.2');
      expect(userPrompt).toContain('5.0.0');
    });

    it('parses valid JSON response correctly', async () => {
      const mockFetch = makeMockFetch(VALID_AI_RESPONSE);
      const provider = new CopilotProvider(config, mockFetch);

      const result = await provider.generateChanges(makeRequest());

      expect(result.fileChanges).toHaveLength(1);
      expect(result.fileChanges[0].filePath).toBe('package.json');
      expect(result.prDescription).toBe('Upgraded express to v5');
      expect(result.errors).toHaveLength(0);
    });

    it('throws on non-OK response', async () => {
      const mockFetch = makeMockFetch({ error: 'Unauthorized' }, 401);
      const provider = new CopilotProvider(config, mockFetch);

      await expect(provider.generateChanges(makeRequest())).rejects.toThrow(
        'AI provider error: 401',
      );
    });

    it('throws on empty response', async () => {
      const mockFetch = makeMockFetch({ choices: [] });
      const provider = new CopilotProvider(config, mockFetch);

      await expect(provider.generateChanges(makeRequest())).rejects.toThrow(
        'AI provider returned empty response',
      );
    });
  });

  describe('parseResponse', () => {
    it('extracts JSON from a code block', () => {
      const provider = new CopilotProvider(config);
      const content = 'Here are the changes:\n```json\n{"fileChanges":[],"prDescription":"done","errors":[]}\n```';
      const result = provider.parseResponse(content);
      expect(result.prDescription).toBe('done');
      expect(result.fileChanges).toEqual([]);
    });

    it('handles raw JSON without code block', () => {
      const provider = new CopilotProvider(config);
      const content = '{"fileChanges":[],"prDescription":"raw","errors":[]}';
      const result = provider.parseResponse(content);
      expect(result.prDescription).toBe('raw');
    });

    it('returns fallback on invalid JSON', () => {
      const provider = new CopilotProvider(config);
      const content = 'This is not JSON at all';
      const result = provider.parseResponse(content);
      expect(result.fileChanges).toEqual([]);
      expect(result.prDescription).toBe(content);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Failed to parse');
    });

    it('handles missing fields gracefully', () => {
      const provider = new CopilotProvider(config);
      const content = '{}';
      const result = provider.parseResponse(content);
      expect(result.fileChanges).toEqual([]);
      expect(result.prDescription).toBe('');
      expect(result.errors).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper function unit tests
// ---------------------------------------------------------------------------

describe('resolveAgentInstructions', () => {
  it('returns custom instructions when provided', () => {
    const result = resolveAgentInstructions('custom', 'repo-file', 'defaults');
    expect(result).toBe('custom');
  });

  it('returns repo file content when no custom instructions', () => {
    const result = resolveAgentInstructions(undefined, 'repo-file', 'defaults');
    expect(result).toBe('repo-file');
  });

  it('returns defaults when no custom or repo file', () => {
    const result = resolveAgentInstructions(undefined, null, 'defaults');
    expect(result).toBe('defaults');
  });
});

describe('buildPrDescription', () => {
  it('includes dependency names and versions', () => {
    const targets: UpgradeTarget[] = [
      { dependencyName: 'express', ecosystem: 'npm', currentVersion: '4.0.0', targetVersion: '5.0.0' },
    ];
    const changes: FileChange[] = [
      { filePath: 'package.json', originalContent: '', modifiedContent: '' },
    ];
    const desc = buildPrDescription(targets, changes);
    expect(desc).toContain('express');
    expect(desc).toContain('4.0.0');
    expect(desc).toContain('5.0.0');
    expect(desc).toContain('package.json');
  });

  it('includes dashboard link when configured', () => {
    const desc = buildPrDescription([], [], 'https://dashboard.example.com', 'migration-123');
    expect(desc).toContain('https://dashboard.example.com/migrations/migration-123');
  });

  it('omits dashboard link when not configured', () => {
    const desc = buildPrDescription([], []);
    expect(desc).not.toContain('dashboard');
  });
});

describe('buildFallbackPrDescription', () => {
  it('lists dependencies with version changes', () => {
    const targets: UpgradeTarget[] = [
      { dependencyName: 'lodash', ecosystem: 'npm', currentVersion: '4.0.0', targetVersion: '5.0.0' },
    ];
    const changes: FileChange[] = [
      { filePath: 'package.json', originalContent: '', modifiedContent: '' },
    ];
    const desc = buildFallbackPrDescription(targets, changes);
    expect(desc).toContain('lodash');
    expect(desc).toContain('4.0.0');
    expect(desc).toContain('5.0.0');
    expect(desc).toContain('package.json');
  });
});


// ---------------------------------------------------------------------------
// Property-Based Tests (Tasks 4.5.1, 4.5.2, 4.5.3)
// ---------------------------------------------------------------------------

// Generators
const upgradeTargetArb = fc.record({
  dependencyName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  ecosystem: fc.constantFrom('npm', 'maven', 'pip', 'cargo', 'gem', 'go'),
  currentVersion: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  targetVersion: fc.option(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    { nil: undefined },
  ),
});

const fileChangeArb = fc.record({
  filePath: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  originalContent: fc.string({ maxLength: 200 }),
  modifiedContent: fc.string({ maxLength: 200 }),
});

describe('AIProvider - Property Tests', () => {
  /**
   * Feature: background-migration-agent, Property 3: Agent instruction precedence
   *
   * For any combination of (customInstructions | null, repoFileContent | null, defaults),
   * the resolveAgentInstructions function should use: custom instructions if provided,
   * else repo-level file content if found, else the built-in defaults.
   * Exactly one source is used, never a mix.
   *
   * **Validates: Requirements 3.2, 3.3, 3.5**
   */
  it('Property 3: Agent instruction precedence — exactly one source is used in priority order', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (customInstructions, repoFileContent, defaults) => {
          const result = resolveAgentInstructions(customInstructions, repoFileContent, defaults);

          if (customInstructions !== undefined && customInstructions !== null) {
            // Custom instructions take highest priority
            expect(result).toBe(customInstructions);
            // Must not contain content from other sources (unless they happen to be equal)
            if (repoFileContent !== null && repoFileContent !== customInstructions) {
              expect(result).not.toBe(repoFileContent);
            }
            if (defaults !== customInstructions) {
              expect(result).not.toBe(defaults);
            }
          } else if (repoFileContent !== null) {
            // Repo file content is second priority
            expect(result).toBe(repoFileContent);
            if (defaults !== repoFileContent) {
              expect(result).not.toBe(defaults);
            }
          } else {
            // Defaults are last resort
            expect(result).toBe(defaults);
          }

          // Exactly one source is used — result must equal one of the three inputs
          const matchesCustom = customInstructions !== undefined && customInstructions !== null && result === customInstructions;
          const matchesRepo = repoFileContent !== null && result === repoFileContent;
          const matchesDefaults = result === defaults;
          expect(matchesCustom || matchesRepo || matchesDefaults).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: background-migration-agent, Property 5: PR description contains required information
   *
   * For any set of upgrade targets with version changes and any set of file changes,
   * the generated PR description should contain: each upgraded dependency name,
   * the from-version and to-version for each, all modified file paths,
   * and a dashboard link (when DASHBOARD_BASE_URL is configured).
   *
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it('Property 5: PR description contains all dependency names, versions, file paths, and dashboard link', () => {
    fc.assert(
      fc.property(
        fc.array(upgradeTargetArb, { minLength: 1, maxLength: 10 }),
        fc.array(fileChangeArb, { minLength: 1, maxLength: 10 }),
        fc.option(
          fc.webUrl().filter((u) => u.length > 0),
          { nil: undefined },
        ),
        fc.uuid(),
        (targets, changes, dashboardBaseUrl, migrationId) => {
          const desc = buildPrDescription(targets, changes, dashboardBaseUrl, migrationId);

          // Every dependency name must appear
          for (const target of targets) {
            expect(desc).toContain(target.dependencyName);
          }

          // Every from-version must appear
          for (const target of targets) {
            expect(desc).toContain(target.currentVersion);
          }

          // Every to-version (or 'latest') must appear
          for (const target of targets) {
            const to = target.targetVersion ?? 'latest';
            expect(desc).toContain(to);
          }

          // Every modified file path must appear
          for (const change of changes) {
            expect(desc).toContain(change.filePath);
          }

          // Dashboard link when configured
          if (dashboardBaseUrl) {
            expect(desc).toContain(dashboardBaseUrl);
            expect(desc).toContain(migrationId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: background-migration-agent, Property 6: Fallback PR description on AI failure
   *
   * For any set of upgrade targets, when the AI provider fails to generate a PR description,
   * the fallback template should list each dependency name with its version change (from → to)
   * and all modified file paths.
   *
   * **Validates: Requirements 5.5**
   */
  it('Property 6: Fallback PR description lists all dependency names, version changes, and file paths', () => {
    fc.assert(
      fc.property(
        fc.array(upgradeTargetArb, { minLength: 1, maxLength: 10 }),
        fc.array(fileChangeArb, { minLength: 1, maxLength: 10 }),
        (targets, changes) => {
          const desc = buildFallbackPrDescription(targets, changes);

          // Every dependency name must appear
          for (const target of targets) {
            expect(desc).toContain(target.dependencyName);
          }

          // Every from-version must appear
          for (const target of targets) {
            expect(desc).toContain(target.currentVersion);
          }

          // Every to-version (or 'latest') must appear
          for (const target of targets) {
            const to = target.targetVersion ?? 'latest';
            expect(desc).toContain(to);
          }

          // Every file path must appear
          for (const change of changes) {
            expect(desc).toContain(change.filePath);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
