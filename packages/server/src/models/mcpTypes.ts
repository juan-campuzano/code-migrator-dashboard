/** Status of the MCP session */
export type McpSessionStatus = 'connected' | 'disconnected';

/** A tool discovered from the MCP server */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Result from starting the MCP server */
export interface McpStartResult {
  status: McpSessionStatus;
  tools: McpTool[];
}

/** Result from executing a tool call */
export interface McpToolResult {
  content: string;
  isError: boolean;
}

/** API response for status endpoint */
export interface McpStatusResponse {
  status: McpSessionStatus;
  tools: McpTool[];
}

/** API request for prompt endpoint */
export interface McpPromptRequest {
  prompt: string;
}

/** API response for prompt endpoint */
export interface McpPromptResponse {
  response: string;
}

/** API response for system prompt endpoint */
export interface McpSystemPromptResponse {
  prompt: string;
  isDefault: boolean;
}

/** API request for updating system prompt */
export interface McpSystemPromptUpdateRequest {
  prompt: string;
}
