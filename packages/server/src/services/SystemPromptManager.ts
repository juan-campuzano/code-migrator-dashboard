/**
 * Stores and validates the custom system prompt for Claude API calls.
 * In-memory storage — no persistence across server restarts.
 */
export class SystemPromptManager {
  static readonly DEFAULT_PROMPT: string =
    'You are an Angular development assistant. Use the available MCP tools to help with Angular CLI operations, ' +
    'code generation, project configuration, and other Angular-related tasks. ' +
    'Provide clear explanations of the actions you take and suggest best practices.';

  static readonly MAX_PROMPT_LENGTH = 10_000;

  private customPrompt: string | null = null;

  /**
   * Returns the current system prompt — custom if set, otherwise the default.
   */
  getPrompt(): string {
    return this.customPrompt ?? SystemPromptManager.DEFAULT_PROMPT;
  }

  /**
   * Validates and stores a custom system prompt.
   * @throws {Error} if the prompt is empty after trimming or exceeds 10,000 characters.
   */
  setPrompt(prompt: string): void {
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('System prompt must be a non-empty string.');
    }
    if (prompt.trim().length > SystemPromptManager.MAX_PROMPT_LENGTH) {
      throw new Error(
        `System prompt must not exceed ${SystemPromptManager.MAX_PROMPT_LENGTH} characters.`,
      );
    }
    this.customPrompt = prompt.trim();
  }

  /**
   * Clears the custom prompt, reverting to the default.
   */
  resetToDefault(): void {
    this.customPrompt = null;
  }
}
