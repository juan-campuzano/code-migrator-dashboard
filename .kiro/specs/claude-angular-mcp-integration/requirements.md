# Requirements Document

## Introduction

This feature integrates the Angular CLI MCP (Model Context Protocol) server with the existing MigrationAgent workflow, enabling the MigrationAgent to leverage Angular CLI tooling (via MCP tools) during migration execution. The server-side component manages the MCP server lifecycle, discovers available tools, and provides an MCP-aware AI provider that uses a Claude conversation loop with tool execution instead of single-shot API calls. The existing `AI_PROVIDER_API_KEY` is reused for Claude API authentication. A web frontend provides a dashboard UI for monitoring MCP server status, configuring system prompts, and sending ad-hoc prompts.

## Glossary

- **MCP_Client**: The server-side component that connects to and communicates with an MCP server using the Model Context Protocol, managing the server process lifecycle and tool discovery.
- **MCP_Server**: An external process (Angular CLI MCP) spawned via `npx -y @angular/cli mcp` that exposes Angular CLI tools over the Model Context Protocol.
- **Tool_Registry**: An in-memory store that holds the list of tools discovered from the MCP_Server, mapped to Claude-compatible tool definitions.
- **System_Prompt_Manager**: The component responsible for storing, retrieving, and validating custom system prompts used when calling the Claude API.
- **MCP_Session**: An active connection between the MCP_Client and the MCP_Server, including the spawned child process and transport layer.
- **Tool_Call**: A single invocation of an MCP tool requested by Claude during a conversation, executed against the MCP_Server.
- **Conversation_Loop**: The iterative process where Claude responses containing tool-use blocks are executed against the MCP_Server, and results are fed back to Claude until a final text response is produced.
- **MigrationAgent**: The existing service that polls for migration jobs, uses an AIProvider to generate file changes, and creates GitHub pull requests.
- **AIProvider**: The interface with a single method `generateChanges(request: AIProviderRequest): Promise<AIProviderResponse>` used by the MigrationAgent to produce file changes.
- **ClaudeProvider**: The existing single-shot Claude API implementation of AIProvider that does not use MCP tools.
- **McpClaudeProvider**: A new AIProvider implementation that uses the Conversation_Loop with MCP tools to generate file changes, replacing single-shot calls with multi-turn tool-assisted interactions.
- **Angular_MCP_Service**: The Express API layer that exposes endpoints for managing the MCP integration from the web frontend.
- **MCP_Dashboard**: The Angular 17 web UI component that allows users to configure, monitor, and interact with the Claude-MCP integration.

## Requirements

### Requirement 1: MCP Server Lifecycle Management

**User Story:** As a developer, I want the server to manage the Angular CLI MCP server process, so that MCP tools are available for both the MigrationAgent and ad-hoc prompts without manual process management.

#### Acceptance Criteria

1. WHEN the MCP_Client receives a start command, THE MCP_Client SHALL spawn the MCP_Server process using the command `npx` with arguments `["-y", "@angular/cli", "mcp"]`.
2. WHEN the MCP_Server process is spawned, THE MCP_Client SHALL establish a stdio-based transport connection to the MCP_Server.
3. WHEN the MCP_Session is established, THE MCP_Client SHALL retrieve the list of available tools from the MCP_Server.
4. WHEN the MCP_Client retrieves tools from the MCP_Server, THE Tool_Registry SHALL store each tool with its name, description, and input schema.
5. IF the MCP_Server process exits unexpectedly, THEN THE MCP_Client SHALL update the MCP_Session status to "disconnected" and log the exit code.
6. WHEN the MCP_Client receives a stop command, THE MCP_Client SHALL terminate the MCP_Server child process and close the transport connection.
7. THE MCP_Client SHALL expose a method to check whether the MCP_Session is currently active.
8. THE MCP_Client SHALL be a shared singleton instance used by both the MigrationAgent (via McpClaudeProvider) and the Angular_MCP_Service API endpoints.

### Requirement 2: MCP-Aware AI Provider for Migration Agent

**User Story:** As a developer, I want the MigrationAgent to use MCP tools during migration execution, so that Angular CLI operations (schematics, code generation, analysis) can be performed as part of the automated migration workflow.

#### Acceptance Criteria

1. THE McpClaudeProvider SHALL implement the AIProvider interface by providing a `generateChanges(request: AIProviderRequest): Promise<AIProviderResponse>` method.
2. WHEN the McpClaudeProvider receives a generateChanges request, THE McpClaudeProvider SHALL construct a Claude API prompt from the upgrade targets, agent instructions, and repository context in the request.
3. WHEN the McpClaudeProvider sends a request to the Claude API, THE McpClaudeProvider SHALL include all tools from the Tool_Registry formatted as Claude tool definitions.
4. WHEN the Claude API response contains one or more tool-use content blocks, THE McpClaudeProvider SHALL execute each Tool_Call against the MCP_Server via the MCP_Client and feed the results back to Claude in a Conversation_Loop.
5. WHEN the Conversation_Loop produces a final text response, THE McpClaudeProvider SHALL parse the response into an AIProviderResponse containing file changes, a PR description, and any errors.
6. THE McpClaudeProvider SHALL read the API key from the `AI_PROVIDER_API_KEY` environment variable, reusing the same key already configured for the existing ClaudeProvider.
7. IF the MCP_Session is not active when generateChanges is called, THEN THE McpClaudeProvider SHALL fall back to single-shot Claude API behavior without MCP tools.
8. IF a Tool_Call execution against the MCP_Server fails, THEN THE McpClaudeProvider SHALL include the error message as the tool result and continue the Conversation_Loop.

### Requirement 3: Claude Conversation Loop with MCP Tools

**User Story:** As a developer, I want Claude to iteratively call MCP tools and receive results during a conversation, so that complex multi-step Angular operations can be completed in a single prompt execution.

#### Acceptance Criteria

1. WHEN a user prompt or migration request is submitted, THE Conversation_Loop SHALL send a request to the Anthropic Claude Messages API with the prompt, the system prompt, and all tools from the Tool_Registry formatted as Claude tool definitions.
2. WHEN the Claude API response contains one or more tool-use content blocks, THE Conversation_Loop SHALL execute each Tool_Call against the MCP_Server and collect the results.
3. WHEN all Tool_Call results for a response are collected, THE Conversation_Loop SHALL send a follow-up request to the Claude API with the tool results appended to the message history.
4. WHEN the Claude API response contains only text content blocks and no tool-use blocks, THE Conversation_Loop SHALL return the final text response to the caller.
5. THE Conversation_Loop SHALL include the `x-api-key` header and `anthropic-version: 2023-06-01` header in each request to the Anthropic Messages API.
6. IF the Claude API returns an HTTP error status, THEN THE Conversation_Loop SHALL return a descriptive error containing the status code and error message from the response body.
7. IF a Tool_Call execution against the MCP_Server fails, THEN THE Conversation_Loop SHALL include the error message as the tool result and continue the conversation loop.

### Requirement 4: MigrationAgent Integration

**User Story:** As a developer, I want the MigrationAgent to be wired to the McpClaudeProvider when MCP is enabled, so that migration jobs automatically benefit from Angular CLI MCP tools.

#### Acceptance Criteria

1. WHEN the `AI_PROVIDER_TYPE` environment variable is set to `claude-mcp`, THE application SHALL instantiate the McpClaudeProvider and inject it as the AIProvider for the MigrationAgent.
2. WHEN the `AI_PROVIDER_TYPE` environment variable is set to `claude-mcp`, THE application SHALL start the MCP_Server automatically during server startup.
3. WHEN the `AI_PROVIDER_TYPE` is set to `claude` or `copilot`, THE application SHALL use the existing ClaudeProvider or CopilotProvider without MCP integration.
4. THE McpClaudeProvider SHALL use the same `AI_PROVIDER_API_KEY` environment variable as the existing ClaudeProvider for Claude API authentication.
5. THE McpClaudeProvider SHALL use the `AI_PROVIDER_MODEL` environment variable to select the Claude model, defaulting to `claude-sonnet-4-20250514` when not set.

### Requirement 5: Custom System Prompt Management

**User Story:** As a developer, I want to configure a custom system prompt for Claude, so that I can tailor Claude's behavior for my Angular project needs.

#### Acceptance Criteria

1. THE System_Prompt_Manager SHALL provide a default system prompt that instructs Claude to act as an Angular development assistant using the available MCP tools.
2. WHEN a custom system prompt is submitted via the API, THE System_Prompt_Manager SHALL validate that the prompt is a non-empty string with a maximum length of 10,000 characters.
3. WHEN a valid custom system prompt is stored, THE Conversation_Loop SHALL use the custom system prompt instead of the default prompt for subsequent requests.
4. WHEN no custom system prompt is configured, THE Conversation_Loop SHALL use the default system prompt from the System_Prompt_Manager.
5. THE Angular_MCP_Service SHALL expose a GET endpoint to retrieve the current system prompt.
6. THE Angular_MCP_Service SHALL expose a PUT endpoint to update the custom system prompt.

### Requirement 6: Server-Side API Endpoints

**User Story:** As a frontend developer, I want REST API endpoints for the MCP integration, so that the Angular web app can control and interact with the Claude-MCP system.

#### Acceptance Criteria

1. THE Angular_MCP_Service SHALL expose a POST `/api/mcp/start` endpoint that starts the MCP_Server and returns the connection status and discovered tool list.
2. THE Angular_MCP_Service SHALL expose a POST `/api/mcp/stop` endpoint that stops the MCP_Server and returns a confirmation.
3. THE Angular_MCP_Service SHALL expose a GET `/api/mcp/status` endpoint that returns the current MCP_Session status and the list of available tools.
4. THE Angular_MCP_Service SHALL expose a POST `/api/mcp/prompt` endpoint that accepts a user prompt string, executes the Conversation_Loop, and returns the final Claude response.
5. THE Angular_MCP_Service SHALL expose a GET `/api/mcp/system-prompt` endpoint that returns the current system prompt.
6. THE Angular_MCP_Service SHALL expose a PUT `/api/mcp/system-prompt` endpoint that accepts and stores a new custom system prompt.
7. IF the `/api/mcp/prompt` endpoint is called while the MCP_Session is not active, THEN THE Angular_MCP_Service SHALL return an HTTP 409 status with an error message indicating the MCP server is not connected.
8. IF the `/api/mcp/start` endpoint is called while the MCP_Session is already active, THEN THE Angular_MCP_Service SHALL return an HTTP 409 status with an error message indicating the MCP server is already running.

### Requirement 7: Angular Web UI for MCP Interaction

**User Story:** As a developer, I want a web interface to manage and interact with the Claude-MCP integration, so that I can start/stop the MCP server, configure prompts, and view responses in the browser.

#### Acceptance Criteria

1. THE MCP_Dashboard SHALL display the current MCP_Session connection status as "connected" or "disconnected".
2. THE MCP_Dashboard SHALL provide a button to start the MCP_Server when the status is "disconnected".
3. THE MCP_Dashboard SHALL provide a button to stop the MCP_Server when the status is "connected".
4. WHILE the MCP_Session status is "connected", THE MCP_Dashboard SHALL display the list of available tools with their names and descriptions.
5. THE MCP_Dashboard SHALL provide a text input area for entering user prompts and a submit button to send the prompt to the `/api/mcp/prompt` endpoint.
6. WHEN a prompt response is received, THE MCP_Dashboard SHALL display the final Claude text response in a response panel.
7. THE MCP_Dashboard SHALL provide a text area for viewing and editing the custom system prompt, with a save button that calls the PUT `/api/mcp/system-prompt` endpoint.
8. WHILE a prompt request is in progress, THE MCP_Dashboard SHALL display a loading indicator and disable the submit button.
9. IF an API call from the MCP_Dashboard fails, THEN THE MCP_Dashboard SHALL display the error message to the user in an error notification area.

### Requirement 8: MCP Configuration Validation

**User Story:** As a developer, I want the system to validate the MCP server configuration, so that misconfiguration is caught early with clear error messages.

#### Acceptance Criteria

1. WHEN the MCP_Client attempts to start the MCP_Server, THE MCP_Client SHALL verify that the `npx` command is available on the system PATH before spawning the process.
2. IF the `npx` command is not found on the system PATH, THEN THE MCP_Client SHALL return an error with the message "npx is not available on the system PATH".
3. IF the MCP_Server process fails to start within 30 seconds, THEN THE MCP_Client SHALL terminate the process and return a timeout error.
4. WHEN the MCP_Client successfully connects to the MCP_Server, THE MCP_Client SHALL log the number of tools discovered.

### Requirement 9: Environment Variable Configuration

**User Story:** As a developer, I want to configure the Claude-MCP integration through environment variables, so that I can manage settings across different environments.

#### Acceptance Criteria

1. THE McpClaudeProvider SHALL read the API key from the `AI_PROVIDER_API_KEY` environment variable, reusing the same key used by the existing ClaudeProvider and MigrationAgent.
2. THE McpClaudeProvider SHALL read the Claude model identifier from the `AI_PROVIDER_MODEL` environment variable, defaulting to `claude-sonnet-4-20250514` when not set.
3. THE Conversation_Loop SHALL read the maximum token count from the `CLAUDE_MAX_TOKENS` environment variable, defaulting to 8192 when not set.
4. IF the `AI_PROVIDER_API_KEY` environment variable is not set, THEN THE Angular_MCP_Service SHALL return an HTTP 503 status on all MCP prompt endpoints with an error message indicating the API key is not configured.
5. WHEN the `AI_PROVIDER_TYPE` environment variable is set to `claude-mcp`, THE application SHALL enable MCP integration for the MigrationAgent.
