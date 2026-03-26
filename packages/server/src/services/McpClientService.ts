import { execFileSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  McpTool,
  McpStartResult,
  McpToolResult,
  McpSessionStatus,
} from '../models/mcpTypes';

/**
 * Manages the Angular CLI MCP server child process lifecycle and tool discovery.
 * Uses the @modelcontextprotocol/sdk to communicate over stdio transport.
 */
export class McpClientService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: McpTool[] = [];
  private status: McpSessionStatus = 'disconnected';

  /**
   * Spawns `npx -y @angular/cli mcp` via StdioClientTransport, connects,
   * lists tools, and populates the tool registry.
   * Enforces a 30-second timeout on the entire start sequence.
   */
  async start(): Promise<McpStartResult> {
    // Verify npx is available on PATH
    this.verifyNpx();

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@talzach/mcp-angular-cli'],
    });

    const client = new Client({
      name: 'angular-mcp-client',
      version: '1.0.0',
    });

    // Handle unexpected process exit
    transport.onclose = () => {
      if (this.status === 'connected') {
        this.status = 'disconnected';
        this.client = null;
        this.transport = null;
        this.tools = [];
        console.error('MCP server process exited unexpectedly');
      }
    };

    // Enforce 30s timeout on the entire start sequence
    const timeoutMs = 30_000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('MCP server failed to start within 30 seconds')), timeoutMs);
    });

    try {
      await Promise.race([
        this.connectAndDiscover(client, transport),
        timeoutPromise,
      ]);
    } catch (error) {
      // On failure or timeout, clean up
      try {
        await transport.close();
      } catch {
        // Ignore cleanup errors
      }
      this.status = 'disconnected';
      this.client = null;
      this.transport = null;
      this.tools = [];
      throw error;
    }

    this.client = client;
    this.transport = transport;
    this.status = 'connected';

    console.log(`MCP server started. Discovered ${this.tools.length} tools.`);

    return {
      status: this.status,
      tools: [...this.tools],
    };
  }

  /**
   * Kills the child process and closes the transport.
   */
  async stop(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore close errors
      }
    }

    this.client = null;
    this.transport = null;
    this.tools = [];
    this.status = 'disconnected';
  }

  /**
   * Returns whether the MCP session is currently active.
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Returns discovered tools from the registry.
   */
  getTools(): McpTool[] {
    return [...this.tools];
  }

  /**
   * Executes a tool call against the MCP server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (!this.client || !this.isConnected()) {
      return { content: 'MCP server is not connected', isError: true };
    }

    try {
      const result = await this.client.callTool({ name, arguments: args });

      // Extract text content from the result
      const content = Array.isArray(result.content)
        ? result.content
            .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
            .map((block) => block.text)
            .join('\n')
        : String(result.content ?? '');

      return {
        content,
        isError: result.isError === true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: message, isError: true };
    }
  }

  /**
   * Verifies that `npx` is available on the system PATH.
   * @throws {Error} if npx is not found.
   */
  private verifyNpx(): void {
    try {
      execFileSync('npx', ['--version'], { stdio: 'pipe' });
    } catch {
      throw new Error('npx is not available on the system PATH');
    }
  }

  /**
   * Connects the client via transport and discovers available tools.
   */
  private async connectAndDiscover(client: Client, transport: StdioClientTransport): Promise<void> {
    await client.connect(transport);

    const toolsResult = await client.listTools();
    this.tools = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }
}
