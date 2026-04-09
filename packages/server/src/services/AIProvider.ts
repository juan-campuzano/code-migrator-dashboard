import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  FileChange,
  UpgradeTarget,
  ValidationRequest,
} from '../models/types';

// =============================================================================
// Default agent instructions (used when no custom or repo-level file exists)
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
// Exported helper functions (for testing)
// =============================================================================

/**
 * Resolve which agent instructions to use.
 * Priority: customInstructions > repoFileContent > defaults.
 * Exactly one source is used, never a mix.
 */
export function resolveAgentInstructions(
  customInstructions: string | undefined,
  repoFileContent: string | null,
  defaults: string,
): string {
  if (customInstructions !== undefined && customInstructions !== null) {
    return customInstructions;
  }
  if (repoFileContent !== null) {
    return repoFileContent;
  }
  return defaults;
}

/**
 * Build a PR description containing all dependency names, version changes,
 * modified file paths, and an optional dashboard link.
 */
export function buildPrDescription(
  upgradeTargets: UpgradeTarget[],
  fileChanges: FileChange[],
  dashboardBaseUrl?: string,
  migrationId?: string,
): string {
  const lines: string[] = [];

  lines.push('## Dependency Upgrades');
  lines.push('');

  for (const target of upgradeTargets) {
    const to = target.targetVersion ?? 'latest';
    lines.push(`- **${target.dependencyName}**: ${target.currentVersion} → ${to}`);
  }

  lines.push('');
  lines.push('## Modified Files');
  lines.push('');

  for (const change of fileChanges) {
    lines.push(`- \`${change.filePath}\``);
  }

  if (dashboardBaseUrl && migrationId) {
    lines.push('');
    lines.push('## Dashboard');
    lines.push('');
    lines.push(`[View migration on dashboard](${dashboardBaseUrl}/migrations/${migrationId})`);
  }

  return lines.join('\n');
}

/**
 * Build a fallback PR description when the AI provider fails to generate one.
 * Lists each dependency with version changes and all file paths.
 */
export function buildFallbackPrDescription(
  upgradeTargets: UpgradeTarget[],
  fileChanges: FileChange[],
): string {
  const lines: string[] = [];

  lines.push('## Dependency Upgrades');
  lines.push('');

  for (const target of upgradeTargets) {
    const to = target.targetVersion ?? 'latest';
    lines.push(`- ${target.dependencyName}: ${target.currentVersion} → ${to}`);
  }

  lines.push('');
  lines.push('## Modified Files');
  lines.push('');

  for (const change of fileChanges) {
    lines.push(`- ${change.filePath}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Shared prompt builders
// =============================================================================

export function buildSystemPromptText(request: AIProviderRequest): string {
  const lines: string[] = [];

  lines.push(request.agentInstructions);
  lines.push('');
  lines.push('## Repository Context');
  lines.push('');
  lines.push(`Repository: ${request.repositoryContext.repoName}`);
  lines.push('');
  lines.push('### File Tree');
  lines.push('');

  for (const entry of request.repositoryContext.fileTree) {
    const prefix = entry.type === 'directory' ? '📁 ' : '📄 ';
    lines.push(`${prefix}${entry.path}`);
  }

  lines.push('');
  lines.push('### Manifest Contents');
  lines.push('');

  for (const [path, content] of Object.entries(request.repositoryContext.manifestContents)) {
    lines.push(`#### ${path}`);
    lines.push('```');
    lines.push(content);
    lines.push('```');
    lines.push('');
  }

  const sourceContents = request.repositoryContext.sourceContents ?? {};
  if (Object.keys(sourceContents).length > 0) {
    lines.push('### Source Files');
    lines.push('');
    lines.push('These source files may use APIs from the dependencies being upgraded. Update any deprecated or breaking API usage.');
    lines.push('');

    for (const [path, content] of Object.entries(sourceContents)) {
      lines.push(`#### ${path}`);
      lines.push('```');
      lines.push(content);
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('## Response Format');
  lines.push('');
  lines.push('Respond with a JSON block containing file changes and a PR description:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "fileChanges": [');
  lines.push('    { "filePath": "...", "originalContent": "...", "modifiedContent": "..." }');
  lines.push('  ],');
  lines.push('  "prDescription": "...",');
  lines.push('  "errors": [');
  lines.push('    { "dependencyName": "...", "error": "..." }');
  lines.push('  ]');
  lines.push('}');
  lines.push('```');

  return lines.join('\n');
}

export function buildUserPromptText(request: AIProviderRequest): string {
  const lines: string[] = [];

  lines.push('Please upgrade the following dependencies in ALL relevant manifest files:');
  lines.push('');

  // Group targets by ecosystem for clarity
  const byEcosystem = new Map<string, typeof request.upgradeTargets>();
  for (const target of request.upgradeTargets) {
    const group = byEcosystem.get(target.ecosystem) ?? [];
    group.push(target);
    byEcosystem.set(target.ecosystem, group);
  }

  for (const [ecosystem, targets] of byEcosystem) {
    lines.push(`### ${ecosystem}`);
    for (const target of targets) {
      const to = target.targetVersion ?? 'latest available version';
      lines.push(
        `- **${target.dependencyName}**: ${target.currentVersion} → ${to}`,
      );
    }
    lines.push('');
  }

  lines.push('Update every manifest file listed in the Manifest Contents section that contains any of these dependencies.');

  return lines.join('\n');
}

export function buildValidationPromptText(request: ValidationRequest): string {
  const lines: string[] = [];

  lines.push('The following file changes were generated to upgrade dependencies, but the build/lint analysis found errors.');
  lines.push('Please fix the errors and return the corrected file changes.');
  lines.push('');
  lines.push('## Current File Changes');
  lines.push('');

  for (const change of request.fileChanges) {
    lines.push(`### ${change.filePath}`);
    lines.push('```');
    lines.push(change.modifiedContent);
    lines.push('```');
    lines.push('');
  }

  lines.push('## Errors Found');
  lines.push('');
  lines.push('```');
  lines.push(request.errors);
  lines.push('```');
  lines.push('');
  lines.push('Please return the corrected file changes in the same JSON format:');
  lines.push('```json');
  lines.push('{');
  lines.push('  "fileChanges": [');
  lines.push('    { "filePath": "...", "originalContent": "...", "modifiedContent": "..." }');
  lines.push('  ],');
  lines.push('  "prDescription": "...",');
  lines.push('  "errors": []');
  lines.push('}');
  lines.push('```');

  return lines.join('\n');
}

// =============================================================================
// CopilotProvider (OpenAI-compatible)
// =============================================================================

export class CopilotProvider implements AIProvider {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(config: { apiKey: string; endpoint: string; model?: string }, fetchFn?: typeof globalThis.fetch) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.model = config.model ?? 'gpt-4o';
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async generateChanges(request: AIProviderRequest): Promise<AIProviderResponse> {
    const systemPrompt = buildSystemPromptText(request);
    const userPrompt = buildUserPromptText(request);

    const response = await this.fetchFn(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider returned empty response');
    }

    return this.parseResponse(content);
  }

  parseResponse(content: string): AIProviderResponse {
    return parseAIResponse(content);
  }

  async validateAndFix(request: ValidationRequest): Promise<AIProviderResponse> {
    const systemPrompt = `You are a dependency upgrade assistant that fixes build and lint errors.
Review the errors found after upgrading dependencies and produce corrected file changes.
Preserve the original upgrade intent while fixing any compatibility issues, type errors, or breaking changes.`;

    const userPrompt = buildValidationPromptText(request);

    const response = await this.fetchFn(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider validation error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider returned empty validation response');
    }

    return parseAIResponse(content);
  }
}

// =============================================================================
// Shared response parser
// =============================================================================

export function parseAIResponse(content: string): AIProviderResponse {
  // Try multiple strategies to extract JSON from the AI response

  // Strategy 1: Find the last ```json ... ``` block (greedy match to get the full JSON)
  const jsonBlockMatch = content.match(/```json\s*\n([\s\S]*)\n```/);
  if (jsonBlockMatch) {
    // The greedy match may capture too much if there are multiple code blocks.
    // Find the matching closing ``` by looking for the last one.
    let jsonStr = jsonBlockMatch[1];
    // If there are nested ``` inside, we need the content up to the final ```
    // The greedy regex already handles this — it captures everything between the first ```json and the last ```
    const result = tryParseJson(jsonStr);
    if (result) return result;
  }

  // Strategy 2: Try to find a JSON object starting with { "fileChanges" in the raw content
  const jsonObjectMatch = content.match(/\{[\s\S]*"fileChanges"[\s\S]*\}/);
  if (jsonObjectMatch) {
    // Try to find the balanced JSON by parsing from the match
    const result = tryExtractBalancedJson(content, jsonObjectMatch.index ?? 0);
    if (result) return result;
  }

  // Strategy 3: Try parsing the entire content as JSON
  const result = tryParseJson(content);
  if (result) return result;

  // Fallback: return empty changes with the raw content as description
  return {
    fileChanges: [],
    prDescription: content,
    errors: [{ dependencyName: 'unknown', error: 'Failed to parse AI response as JSON' }],
  };
}

function tryParseJson(jsonStr: string): AIProviderResponse | null {
  try {
    const parsed = JSON.parse(jsonStr.trim()) as {
      fileChanges?: Array<{ filePath: string; originalContent: string; modifiedContent: string }>;
      prDescription?: string;
      errors?: Array<{ dependencyName: string; error: string }>;
    };

    return {
      fileChanges: Array.isArray(parsed.fileChanges) ? parsed.fileChanges : [],
      prDescription: typeof parsed.prDescription === 'string' ? parsed.prDescription : '',
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    };
  } catch {
    return null;
  }
}

function tryExtractBalancedJson(content: string, startIndex: number): AIProviderResponse | null {
  // Walk forward from startIndex to find a balanced JSON object
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < content.length; i++) {
    const ch = content[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = content.substring(startIndex, i + 1);
          return tryParseJson(jsonStr);
        }
      }
    }
  }

  return null;
}

// =============================================================================
// ClaudeProvider
// =============================================================================

export class ClaudeProvider implements AIProvider {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(
    config: { apiKey: string; endpoint?: string; model?: string },
    fetchFn?: typeof globalThis.fetch,
  ) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? 'https://api.anthropic.com';
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }

  async generateChanges(request: AIProviderRequest): Promise<AIProviderResponse> {
    const systemPrompt = buildSystemPromptText(request);
    const userPrompt = buildUserPromptText(request);

    const response = await this.fetchFn(`${this.endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = (await response.json()) as { error?: { message?: string; type?: string } };
        detail = errBody?.error?.message ?? JSON.stringify(errBody);
      } catch {
        detail = response.statusText;
      }
      throw new Error(`AI provider error: ${response.status} — ${detail}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const textBlock = data.content?.find((b) => b.type === 'text');
    if (!textBlock?.text) {
      throw new Error('AI provider returned empty response');
    }

    console.log(`[ClaudeProvider] Response length: ${textBlock.text.length} chars`);
    console.log(`[ClaudeProvider] Response preview: ${textBlock.text.substring(0, 500)}`);

    const result = parseAIResponse(textBlock.text);
    console.log(`[ClaudeProvider] Parsed: ${result.fileChanges.length} file changes, ${result.errors.length} errors`);
    if (result.errors.length > 0) {
      console.log(`[ClaudeProvider] Parse errors:`, result.errors);
    }

    return result;
  }

  async validateAndFix(request: ValidationRequest): Promise<AIProviderResponse> {
    const systemPrompt = `You are a dependency upgrade assistant that fixes build and lint errors.
Review the errors found after upgrading dependencies and produce corrected file changes.
Preserve the original upgrade intent while fixing any compatibility issues, type errors, or breaking changes.`;

    const userPrompt = buildValidationPromptText(request);

    const response = await this.fetchFn(`${this.endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errBody = (await response.json()) as { error?: { message?: string; type?: string } };
        detail = errBody?.error?.message ?? JSON.stringify(errBody);
      } catch {
        detail = response.statusText;
      }
      throw new Error(`AI provider validation error: ${response.status} — ${detail}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const textBlock = data.content?.find((b) => b.type === 'text');
    if (!textBlock?.text) {
      throw new Error('AI provider returned empty validation response');
    }

    console.log(`[ClaudeProvider] Validation response length: ${textBlock.text.length} chars`);
    return parseAIResponse(textBlock.text);
  }
}
