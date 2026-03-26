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
    const systemPrompt = buildSystemPromptText(request);
    const userPrompt = buildUserPromptText(request);
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    try {
      const responseText = await this.conversationClient.executePrompt(fullPrompt);
      return parseAIResponse(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        fileChanges: [],
        prDescription: '',
        errors: [{ dependencyName: 'unknown', error: message }],
      };
    }
  }
}
