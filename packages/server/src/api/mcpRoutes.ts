import { Router, Request, Response } from 'express';
import type { McpClientService } from '../services/McpClientService';
import { SystemPromptManager } from '../services/SystemPromptManager';
import type { ClaudeConversationClient } from '../services/ClaudeConversationClient';
import type { ApiError } from '../models/types';
import type { McpPromptRequest, McpSystemPromptUpdateRequest } from '../models/mcpTypes';

/**
 * Create an Express Router for MCP integration endpoints.
 *
 * POST /start          — start MCP server, return status + tools
 * POST /stop           — stop MCP server, return confirmation
 * GET  /status         — return session status + tool list
 * POST /prompt         — execute conversation loop, return response
 * GET  /system-prompt  — return current system prompt
 * PUT  /system-prompt  — update custom system prompt
 */
export function createMcpRouter(
  mcpClient: McpClientService,
  promptManager: SystemPromptManager,
  conversationClient: ClaudeConversationClient,
): Router {
  const router = Router();

  router.post('/start', async (_req: Request, res: Response) => {
    try {
      if (mcpClient.isConnected()) {
        const error: ApiError = {
          code: 'MCP_ALREADY_RUNNING',
          message: 'MCP server is already running.',
        };
        res.status(409).json(error);
        return;
      }

      const result = await mcpClient.start();
      res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.post('/stop', async (_req: Request, res: Response) => {
    try {
      await mcpClient.stop();
      res.status(200).json({ message: 'MCP server stopped.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/status', (_req: Request, res: Response) => {
    const status = mcpClient.isConnected() ? 'connected' : 'disconnected';
    const tools = mcpClient.getTools();
    res.status(200).json({ status, tools });
  });

  router.post('/prompt', async (req: Request, res: Response) => {
    try {
      if (!process.env.AI_PROVIDER_API_KEY) {
        const error: ApiError = {
          code: 'MCP_API_KEY_MISSING',
          message: 'AI_PROVIDER_API_KEY environment variable is not configured.',
        };
        res.status(503).json(error);
        return;
      }

      if (!mcpClient.isConnected()) {
        const error: ApiError = {
          code: 'MCP_NOT_CONNECTED',
          message: 'MCP server is not connected. Start the MCP server first.',
        };
        res.status(409).json(error);
        return;
      }

      const { prompt } = (req.body ?? {}) as McpPromptRequest;
      if (!prompt || typeof prompt !== 'string') {
        const error: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'Request body must include a non-empty "prompt" string.',
        };
        res.status(400).json(error);
        return;
      }

      const response = await conversationClient.executePrompt(prompt);
      res.status(200).json({ response });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message } satisfies ApiError);
    }
  });

  router.get('/system-prompt', (_req: Request, res: Response) => {
    const prompt = promptManager.getPrompt();
    const isDefault = prompt === SystemPromptManager.DEFAULT_PROMPT;
    res.status(200).json({ prompt, isDefault });
  });

  router.put('/system-prompt', (req: Request, res: Response) => {
    try {
      const { prompt } = (req.body ?? {}) as McpSystemPromptUpdateRequest;
      if (prompt === undefined || prompt === null) {
        const error: ApiError = {
          code: 'VALIDATION_ERROR',
          message: 'Request body must include a "prompt" string.',
        };
        res.status(400).json(error);
        return;
      }

      promptManager.setPrompt(prompt);
      const currentPrompt = promptManager.getPrompt();
      res.status(200).json({ prompt: currentPrompt, isDefault: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const error: ApiError = {
        code: 'VALIDATION_ERROR',
        message,
      };
      res.status(400).json(error);
    }
  });

  return router;
}
