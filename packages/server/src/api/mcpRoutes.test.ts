import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { createMcpRouter } from './mcpRoutes';
import type { McpClientService } from '../services/McpClientService';
import { SystemPromptManager } from '../services/SystemPromptManager';
import type { ClaudeConversationClient } from '../services/ClaudeConversationClient';

// --- Helpers ---

function createMockMcpClient(overrides: Partial<McpClientService> = {}) {
  return {
    start: vi.fn().mockResolvedValue({
      status: 'connected',
      tools: [{ name: 'ng-generate', description: 'Generate Angular artifacts', inputSchema: {} }],
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false),
    getTools: vi.fn().mockReturnValue([]),
    callTool: vi.fn().mockResolvedValue({ content: '', isError: false }),
    ...overrides,
  } as unknown as McpClientService;
}

function createMockConversationClient(overrides: Partial<ClaudeConversationClient> = {}) {
  return {
    executePrompt: vi.fn().mockResolvedValue('Claude response text'),
    ...overrides,
  } as unknown as ClaudeConversationClient;
}

function startApp(
  mcpClient: McpClientService,
  promptManager: SystemPromptManager,
  conversationClient: ClaudeConversationClient,
) {
  const app = express();
  app.use(express.json());
  app.use('/api/mcp', createMcpRouter(mcpClient, promptManager, conversationClient));

  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// --- Tests ---

describe('mcpRoutes', () => {
  let promptManager: SystemPromptManager;

  beforeEach(() => {
    promptManager = new SystemPromptManager();
  });

  // ---- POST /api/mcp/start ----

  describe('POST /api/mcp/start', () => {
    it('returns 200 with status and tools on success', async () => {
      const mcpClient = createMockMcpClient({ isConnected: vi.fn().mockReturnValue(false) });
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/start`, { method: 'POST' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('connected');
        expect(body.tools).toHaveLength(1);
        expect(body.tools[0].name).toBe('ng-generate');
        expect(mcpClient.start).toHaveBeenCalled();
      } finally {
        server.close();
      }
    });

    it('returns 409 when MCP server is already running', async () => {
      const mcpClient = createMockMcpClient({ isConnected: vi.fn().mockReturnValue(true) });
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/start`, { method: 'POST' });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.code).toBe('MCP_ALREADY_RUNNING');
        expect(mcpClient.start).not.toHaveBeenCalled();
      } finally {
        server.close();
      }
    });
  });

  // ---- POST /api/mcp/stop ----

  describe('POST /api/mcp/stop', () => {
    it('returns 200 with confirmation on success', async () => {
      const mcpClient = createMockMcpClient();
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/stop`, { method: 'POST' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toContain('stopped');
        expect(mcpClient.stop).toHaveBeenCalled();
      } finally {
        server.close();
      }
    });
  });

  // ---- GET /api/mcp/status ----

  describe('GET /api/mcp/status', () => {
    it('returns current status and tools', async () => {
      const tools = [
        { name: 'ng-serve', description: 'Serve the app', inputSchema: { type: 'object' } },
      ];
      const mcpClient = createMockMcpClient({
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi.fn().mockReturnValue(tools),
      });
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/status`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('connected');
        expect(body.tools).toHaveLength(1);
        expect(body.tools[0].name).toBe('ng-serve');
      } finally {
        server.close();
      }
    });
  });

  // ---- POST /api/mcp/prompt ----

  describe('POST /api/mcp/prompt', () => {
    it('returns 200 with response on success', async () => {
      const originalKey = process.env.AI_PROVIDER_API_KEY;
      process.env.AI_PROVIDER_API_KEY = 'test-key';

      const mcpClient = createMockMcpClient({ isConnected: vi.fn().mockReturnValue(true) });
      const convClient = createMockConversationClient({
        executePrompt: vi.fn().mockResolvedValue('Generated component successfully'),
      });
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Generate a new component' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.response).toBe('Generated component successfully');
        expect(convClient.executePrompt).toHaveBeenCalledWith('Generate a new component');
      } finally {
        process.env.AI_PROVIDER_API_KEY = originalKey;
        server.close();
      }
    });

    it('returns 409 when MCP server is disconnected', async () => {
      const originalKey = process.env.AI_PROVIDER_API_KEY;
      process.env.AI_PROVIDER_API_KEY = 'test-key';

      const mcpClient = createMockMcpClient({ isConnected: vi.fn().mockReturnValue(false) });
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Hello' }),
        });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.code).toBe('MCP_NOT_CONNECTED');
      } finally {
        process.env.AI_PROVIDER_API_KEY = originalKey;
        server.close();
      }
    });

    it('returns 503 when AI_PROVIDER_API_KEY is missing', async () => {
      const originalKey = process.env.AI_PROVIDER_API_KEY;
      delete process.env.AI_PROVIDER_API_KEY;

      const mcpClient = createMockMcpClient({ isConnected: vi.fn().mockReturnValue(true) });
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'Hello' }),
        });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.code).toBe('MCP_API_KEY_MISSING');
      } finally {
        process.env.AI_PROVIDER_API_KEY = originalKey;
        server.close();
      }
    });

    it('returns 400 when prompt is missing from body', async () => {
      const originalKey = process.env.AI_PROVIDER_API_KEY;
      process.env.AI_PROVIDER_API_KEY = 'test-key';

      const mcpClient = createMockMcpClient({ isConnected: vi.fn().mockReturnValue(true) });
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toContain('prompt');
      } finally {
        process.env.AI_PROVIDER_API_KEY = originalKey;
        server.close();
      }
    });
  });

  // ---- GET /api/mcp/system-prompt ----

  describe('GET /api/mcp/system-prompt', () => {
    it('returns the current default system prompt', async () => {
      const mcpClient = createMockMcpClient();
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/system-prompt`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.prompt).toBe(SystemPromptManager.DEFAULT_PROMPT);
        expect(body.isDefault).toBe(true);
      } finally {
        server.close();
      }
    });
  });

  // ---- PUT /api/mcp/system-prompt ----

  describe('PUT /api/mcp/system-prompt', () => {
    it('returns 200 with updated prompt on success', async () => {
      const mcpClient = createMockMcpClient();
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/system-prompt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'You are a helpful Angular expert.' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.prompt).toBe('You are a helpful Angular expert.');
        expect(body.isDefault).toBe(false);
      } finally {
        server.close();
      }
    });

    it('returns 400 when prompt validation fails (empty string)', async () => {
      const mcpClient = createMockMcpClient();
      const convClient = createMockConversationClient();
      const { server, baseUrl } = await startApp(mcpClient, promptManager, convClient);

      try {
        const res = await fetch(`${baseUrl}/api/mcp/system-prompt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: '   ' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe('VALIDATION_ERROR');
      } finally {
        server.close();
      }
    });
  });
});
