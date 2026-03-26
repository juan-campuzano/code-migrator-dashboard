import type { McpClientService } from './McpClientService';
import type { SystemPromptManager } from './SystemPromptManager';

/** Shape of a single content block in a Claude API response. */
interface ClaudeContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Shape of the Claude Messages API response body. */
interface ClaudeApiResponse {
  content: ClaudeContentBlock[];
  stop_reason: string;
  model: string;
  role: string;
}

/** Shape of a Claude Messages API error body. */
interface ClaudeApiError {
  error?: { type?: string; message?: string };
}

/** A single message in the conversation history. */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[] | ToolResultContent[];
}

/** A tool-result content block sent back to Claude. */
interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

/** A Claude tool definition derived from an MCP tool. */
interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 8192;

/**
 * Handles the Claude API conversation loop with MCP tool execution.
 * Sends prompts to the Anthropic Messages API, iterates tool-use blocks
 * by calling McpClientService, and returns the final text response.
 */
export class ClaudeConversationClient {
  private readonly mcpClient: McpClientService;
  private readonly promptManager: SystemPromptManager;

  constructor(mcpClient: McpClientService, promptManager: SystemPromptManager) {
    this.mcpClient = mcpClient;
    this.promptManager = promptManager;
  }

  /** Resolve the API key from the environment. */
  private getApiKey(): string | undefined {
    return process.env.AI_PROVIDER_API_KEY;
  }

  /** Resolve the Claude model from the environment or use the default. */
  private getModel(): string {
    return process.env.AI_PROVIDER_MODEL || DEFAULT_MODEL;
  }

  /** Resolve max tokens from the environment or use the default. */
  private getMaxTokens(): number {
    const envVal = process.env.CLAUDE_MAX_TOKENS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      return Number.isNaN(parsed) ? DEFAULT_MAX_TOKENS : parsed;
    }
    return DEFAULT_MAX_TOKENS;
  }

  /**
   * Format MCP tools as Claude tool definitions.
   */
  private formatTools(): ClaudeToolDefinition[] {
    return this.mcpClient.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Sends the prompt to Claude with tools and system prompt, iterates the
   * conversation loop until a text-only response is returned.
   */
  async executePrompt(userMessage: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('AI_PROVIDER_API_KEY is not configured');
    }

    const systemPrompt = this.promptManager.getPrompt();
    const tools = this.formatTools();
    const messages: ConversationMessage[] = [{ role: 'user', content: userMessage }];

    // Conversation loop — keep going while Claude requests tool use
    while (true) {
      const response = await this.callClaudeApi(apiKey, systemPrompt, messages, tools);

      const toolUseBlocks = response.content.filter(
        (block): block is ClaudeContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
          block.type === 'tool_use',
      );

      // If no tool-use blocks, extract text and return
      if (toolUseBlocks.length === 0) {
        return response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('');
      }

      // Append the assistant response (with tool_use blocks) to history
      messages.push({ role: 'assistant', content: response.content });

      // Execute each tool call and collect results
      const toolResults: ToolResultContent[] = [];
      for (const block of toolUseBlocks) {
        try {
          const result = await this.mcpClient.callTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.content,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${errorMessage}`,
          });
        }
      }

      // Append tool results as a user message and continue the loop
      messages.push({ role: 'user', content: toolResults });
    }
  }

  /**
   * Makes a single call to the Anthropic Messages API.
   */
  private async callClaudeApi(
    apiKey: string,
    systemPrompt: string,
    messages: ConversationMessage[],
    tools: ClaudeToolDefinition[],
  ): Promise<ClaudeApiResponse> {
    const body = {
      model: this.getModel(),
      max_tokens: this.getMaxTokens(),
      system: systemPrompt,
      messages,
      ...(tools.length > 0 ? { tools } : {}),
    };

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMessage = '';
      try {
        const errorBody = (await res.json()) as ClaudeApiError;
        errorMessage = errorBody.error?.message ?? JSON.stringify(errorBody);
      } catch {
        errorMessage = res.statusText;
      }
      throw new Error(
        `Claude API error (HTTP ${res.status}): ${errorMessage}`,
      );
    }

    return (await res.json()) as ClaudeApiResponse;
  }
}
