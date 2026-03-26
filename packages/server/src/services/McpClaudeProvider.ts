import type { McpClientService } from './McpClientService';
import type { ClaudeConversationClient } from './ClaudeConversationClient';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
} from '../models/types';
import {
  buildSystemPromptText,
  buildUserPromptText,
  parseAIResponse,
} from './AIProvider';

/**
 * AIProvider implementation that bridges the MigrationAgent to the
 * ClaudeConversationClient conversation loop with MCP tools.
 *
 * When MCP is connected, prompts go through the conversation loop so Claude
 * can call Angular CLI tools. When MCP is disconnected, falls back to a
 * single-shot Claude call without tool definitions.
 */
export class McpClaudeProvider implements AIProvider {
  constructor(
    private readonly mcpClient: McpClientService,
    private readonly conversationClient: ClaudeConversationClient,
  ) {}

  async generateChanges(request: AIProviderRequest): Promise<AIProviderResponse> {
    const userPrompt = buildUserPromptText(request);
    const systemContext = buildSystemPromptText(request);

    // Combine the system context (repo info, instructions) with the user prompt
    // The ClaudeConversationClient will add its own system prompt from SystemPromptManager
    const fullUserMessage = `${systemContext}\n\n${userPrompt}`;

    console.log(`[McpClaudeProvider] MCP connected: ${this.mcpClient.isConnected()}`);
    console.log(`[McpClaudeProvider] Tools available: ${this.mcpClient.getTools().length}`);
    console.log(`[McpClaudeProvider] Prompt length: ${fullUserMessage.length} chars`);

    try {
      const responseText = await this.conversationClient.executePrompt(fullUserMessage);
      console.log(`[McpClaudeProvider] Response length: ${responseText.length} chars`);
      console.log(`[McpClaudeProvider] Response preview: ${responseText.substring(0, 500)}`);

      const result = parseAIResponse(responseText);
      console.log(`[McpClaudeProvider] Parsed: ${result.fileChanges.length} file changes, ${result.errors.length} errors`);
      if (result.errors.length > 0) {
        console.log(`[McpClaudeProvider] Parse errors:`, result.errors);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[McpClaudeProvider] Error during generateChanges:`, message);
      return {
        fileChanges: [],
        prDescription: '',
        errors: [{ dependencyName: 'unknown', error: message }],
      };
    }
  }
}
