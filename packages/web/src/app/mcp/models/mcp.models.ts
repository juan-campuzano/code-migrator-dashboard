export type McpSessionStatus = 'connected' | 'disconnected';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpStatusResponse {
  status: McpSessionStatus;
  tools: McpTool[];
}

export interface McpPromptResponse {
  response: string;
}

export interface McpSystemPromptResponse {
  prompt: string;
  isDefault: boolean;
}
