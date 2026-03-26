import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeConversationClient } from './ClaudeConversationClient';
import type { McpClientService } from './McpClientService';
import type { SystemPromptManager } from './SystemPromptManager';
import type { McpTool } from '../models/mcpTypes';

// =============================================================================
// Mock factories
// =============================================================================

function makeMockMcpClient(overrides?: Partial<McpClientService>): McpClientService {
  return {
    start: vi.fn().mockResolvedValue({ status: 'connected', tools: [] }),
    stop: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getTools: vi.fn().mockReturnValue([]),
    callTool: vi.fn().mockResolvedValue({ content: 'tool result', isError: false }),
    ...overrides,
  } as unknown as McpClientService;
}

function makeMockPromptManager(overrides?: Partial<SystemPromptManager>): SystemPromptManager {
  return {
    getPrompt: vi.fn().mockReturnValue('You are an Angular assistant.'),
    setPrompt: vi.fn(),
    resetToDefault: vi.fn(),
    ...overrides,
  } as unknown as SystemPromptManager;
}

/** Build a mock fetch that returns a Claude text-only response. */
function makeTextResponse(text: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      model: 'claude-sonnet-4-20250514',
      role: 'assistant',
    }),
  });
}

/** Build a mock fetch that returns tool_use blocks on first call, then text on second. */
function makeToolUseResponse(
  toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  finalText: string,
) {
  let callCount = 0;
  return vi.fn().mockImplementation(async () => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: toolUseBlocks.map((b) => ({
            type: 'tool_use',
            id: b.id,
            name: b.name,
            input: b.input,
          })),
          stop_reason: 'tool_use',
          model: 'claude-sonnet-4-20250514',
          role: 'assistant',
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: finalText }],
        stop_reason: 'end_turn',
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
      }),
    };
  });
}

/** Build a mock fetch that returns an HTTP error. */
function makeErrorResponse(status: number, errorMessage: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({
      error: { type: 'api_error', message: errorMessage },
    }),
  });
}

// =============================================================================
// Unit Tests — Task 5.7
// =============================================================================

describe('ClaudeConversationClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, AI_PROVIDER_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Single-turn text response
  // ---------------------------------------------------------------------------

  describe('single-turn text response', () => {
    it('returns text when Claude responds with only text blocks', async () => {
      const mockFetch = makeTextResponse('Hello from Claude!');
      vi.stubGlobal('fetch', mockFetch);

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      const result = await client.executePrompt('Hi there');

      expect(result).toBe('Hello from Claude!');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('concatenates multiple text blocks', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            { type: 'text', text: 'Part 1. ' },
            { type: 'text', text: 'Part 2.' },
          ],
          stop_reason: 'end_turn',
          model: 'claude-sonnet-4-20250514',
          role: 'assistant',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      const result = await client.executePrompt('Tell me something');
      expect(result).toBe('Part 1. Part 2.');
    });

    it('includes system prompt, user message, tools, and required headers in the request', async () => {
      const tools: McpTool[] = [
        { name: 'ng-generate', description: 'Generate component', inputSchema: { type: 'object' } },
      ];
      const mockFetch = makeTextResponse('Done');
      vi.stubGlobal('fetch', mockFetch);

      const client = new ClaudeConversationClient(
        makeMockMcpClient({ getTools: vi.fn().mockReturnValue(tools) }),
        makeMockPromptManager({ getPrompt: vi.fn().mockReturnValue('Custom system prompt') }),
      );

      await client.executePrompt('Generate a component');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');

      const headers = init.headers;
      expect(headers['x-api-key']).toBe('test-api-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body);
      expect(body.system).toBe('Custom system prompt');
      expect(body.messages).toEqual([{ role: 'user', content: 'Generate a component' }]);
      expect(body.tools).toEqual([
        { name: 'ng-generate', description: 'Generate component', input_schema: { type: 'object' } },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Multi-turn tool-use loop
  // ---------------------------------------------------------------------------

  describe('multi-turn tool-use loop', () => {
    it('executes tool calls and feeds results back to Claude', async () => {
      const toolUseBlocks = [
        { id: 'call_1', name: 'ng-generate', input: { type: 'component', name: 'foo' } },
        { id: 'call_2', name: 'ng-serve', input: { port: 4200 } },
      ];

      const mockFetch = makeToolUseResponse(toolUseBlocks, 'Components created successfully');
      vi.stubGlobal('fetch', mockFetch);

      const callToolMock = vi.fn()
        .mockResolvedValueOnce({ content: 'Component foo created', isError: false })
        .mockResolvedValueOnce({ content: 'Server started on port 4200', isError: false });

      const mcpClient = makeMockMcpClient({ callTool: callToolMock });
      const client = new ClaudeConversationClient(mcpClient, makeMockPromptManager());

      const result = await client.executePrompt('Create a component');

      // Final text returned
      expect(result).toBe('Components created successfully');

      // Two API calls: first with user prompt, second with tool results
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Tool calls were made
      expect(callToolMock).toHaveBeenCalledTimes(2);
      expect(callToolMock).toHaveBeenCalledWith('ng-generate', { type: 'component', name: 'foo' });
      expect(callToolMock).toHaveBeenCalledWith('ng-serve', { port: 4200 });

      // Second request includes tool results
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      const toolResultMessage = secondCallBody.messages.find(
        (m: { role: string; content: unknown }) =>
          m.role === 'user' && Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
      );
      expect(toolResultMessage).toBeDefined();
      expect(toolResultMessage.content).toHaveLength(2);
      expect(toolResultMessage.content[0].tool_use_id).toBe('call_1');
      expect(toolResultMessage.content[0].content).toBe('Component foo created');
      expect(toolResultMessage.content[1].tool_use_id).toBe('call_2');
      expect(toolResultMessage.content[1].content).toBe('Server started on port 4200');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Claude API error handling
  // ---------------------------------------------------------------------------

  describe('Claude API error handling', () => {
    it('throws a descriptive error when Claude API returns non-ok status', async () => {
      const mockFetch = makeErrorResponse(429, 'Rate limit exceeded');
      vi.stubGlobal('fetch', mockFetch);

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      await expect(client.executePrompt('Hello')).rejects.toThrow(
        'Claude API error (HTTP 429): Rate limit exceeded',
      );
    });

    it('includes status code in error for 500 errors', async () => {
      const mockFetch = makeErrorResponse(500, 'Internal server error');
      vi.stubGlobal('fetch', mockFetch);

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      await expect(client.executePrompt('Hello')).rejects.toThrow('Claude API error (HTTP 500)');
    });

    it('falls back to statusText when error body cannot be parsed', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => { throw new Error('Invalid JSON'); },
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      await expect(client.executePrompt('Hello')).rejects.toThrow(
        'Claude API error (HTTP 502): Bad Gateway',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Tool call failure resilience
  // ---------------------------------------------------------------------------

  describe('tool call failure resilience', () => {
    it('includes error message as tool result when callTool throws, and loop continues', async () => {
      const toolUseBlocks = [
        { id: 'call_1', name: 'ng-generate', input: { name: 'bar' } },
      ];

      const mockFetch = makeToolUseResponse(toolUseBlocks, 'Handled the error gracefully');
      vi.stubGlobal('fetch', mockFetch);

      const callToolMock = vi.fn().mockRejectedValue(new Error('MCP server crashed'));
      const mcpClient = makeMockMcpClient({ callTool: callToolMock });
      const client = new ClaudeConversationClient(mcpClient, makeMockPromptManager());

      const result = await client.executePrompt('Generate bar');

      // Loop should continue and return final text
      expect(result).toBe('Handled the error gracefully');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Error message included as tool result
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      const toolResultMessage = secondCallBody.messages.find(
        (m: { role: string; content: unknown }) =>
          m.role === 'user' && Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
      );
      expect(toolResultMessage.content[0].content).toBe('Error: MCP server crashed');
    });

    it('handles non-Error thrown values from callTool', async () => {
      const toolUseBlocks = [
        { id: 'call_1', name: 'ng-test', input: {} },
      ];

      const mockFetch = makeToolUseResponse(toolUseBlocks, 'Recovered');
      vi.stubGlobal('fetch', mockFetch);

      const callToolMock = vi.fn().mockRejectedValue('string error');
      const mcpClient = makeMockMcpClient({ callTool: callToolMock });
      const client = new ClaudeConversationClient(mcpClient, makeMockPromptManager());

      const result = await client.executePrompt('Run tests');

      expect(result).toBe('Recovered');
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      const toolResultMessage = secondCallBody.messages.find(
        (m: { role: string; content: unknown }) =>
          m.role === 'user' && Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
      );
      expect(toolResultMessage.content[0].content).toBe('Error: string error');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Missing API key
  // ---------------------------------------------------------------------------

  describe('missing API key', () => {
    it('throws when AI_PROVIDER_API_KEY is not set', async () => {
      delete process.env.AI_PROVIDER_API_KEY;

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      await expect(client.executePrompt('Hello')).rejects.toThrow(
        'AI_PROVIDER_API_KEY is not configured',
      );
    });

    it('throws when AI_PROVIDER_API_KEY is empty string', async () => {
      process.env.AI_PROVIDER_API_KEY = '';

      const client = new ClaudeConversationClient(
        makeMockMcpClient(),
        makeMockPromptManager(),
      );

      await expect(client.executePrompt('Hello')).rejects.toThrow(
        'AI_PROVIDER_API_KEY is not configured',
      );
    });
  });
});
