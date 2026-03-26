# Implementation Plan: Claude Angular MCP Integration

## Overview

Incrementally build the Claude + Angular CLI MCP integration across server and web packages. Server-side work comes first (types, services, routes), followed by frontend (module, service, component), then wiring and final validation. Tasks 11+ add the McpClaudeProvider integration with MigrationAgent and unify environment variables under AI_PROVIDER_API_KEY.

## Tasks

- [x] 1. Define shared data models and types
  - [x] 1.1 Create `packages/server/src/models/mcpTypes.ts` with all MCP-related TypeScript interfaces and types
    - `McpSessionStatus`, `McpTool`, `McpStartResult`, `McpToolResult`, `McpStatusResponse`, `McpPromptRequest`, `McpPromptResponse`, `McpSystemPromptResponse`, `McpSystemPromptUpdateRequest`
    - _Requirements: 1.4, 4.1, 4.3, 4.4, 4.5, 4.6_

- [x] 2. Implement SystemPromptManager
  - [x] 2.1 Create `packages/server/src/services/SystemPromptManager.ts`
    - Implement `DEFAULT_PROMPT` static field with Angular assistant instructions
    - Implement `getPrompt()`, `setPrompt(prompt)`, `resetToDefault()`
    - Validate: non-empty after trim, max 10,000 characters; throw on invalid input
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.2 Write property test for SystemPromptManager validation (Property 7)
    - **Property 7: System prompt validation**
    - Generate random strings including empty, whitespace-only, boundary lengths (10,000 and 10,001 chars)
    - Verify validation accepts if and only if non-empty after trim and length ≤ 10,000
    - **Validates: Requirements 3.2**

  - [ ]* 2.3 Write property test for SystemPromptManager round-trip (Property 8)
    - **Property 8: System prompt selection**
    - Generate random valid prompts, set then get, verify round-trip; reset, verify default returned
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 2.4 Write unit tests for SystemPromptManager
    - Test default prompt retrieval, custom prompt storage, edge cases (empty, whitespace, exactly 10,000 chars, 10,001 chars), reset to default
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Implement McpClientService
  - [x] 3.1 Install `@modelcontextprotocol/sdk` dependency in `packages/server`
    - Run `npm install @modelcontextprotocol/sdk` in the server package
    - _Requirements: 1.1, 1.2_

  - [x] 3.2 Create `packages/server/src/services/McpClientService.ts`
    - Implement `start()`: verify `npx` on PATH, spawn `npx -y @angular/cli mcp` via `StdioClientTransport`, connect, list tools, populate registry, enforce 30s timeout
    - Implement `stop()`: kill child process, close transport, update status
    - Implement `isConnected()`: return session active state
    - Implement `getTools()`: return tools from registry
    - Implement `callTool(name, args)`: execute tool call against MCP server, return result
    - Handle unexpected process exit: update status to disconnected, log exit code
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.3 Write property test for tool registry preservation (Property 1)
    - **Property 1: Tool registry preserves all tool metadata**
    - Generate random arrays of `McpTool` objects, store them, verify all retrievable with matching name, description, inputSchema
    - **Validates: Requirements 1.4**

  - [ ]* 3.4 Write property test for connection status lifecycle (Property 2)
    - **Property 2: Connection status reflects lifecycle state**
    - Generate random sequences of start/stop operations, verify `isConnected()` matches expected state
    - **Validates: Requirements 1.7**

  - [ ]* 3.5 Write unit tests for McpClientService
    - Mock `child_process.spawn` and MCP SDK
    - Test start/stop lifecycle, tool discovery, unexpected process exit, npx validation, 30s timeout
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 6.1, 6.2, 6.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement ClaudeConversationClient
  - [x] 5.1 Create `packages/server/src/services/ClaudeConversationClient.ts`
    - Read `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (default `claude-sonnet-4-20250514`), `CLAUDE_MAX_TOKENS` (default `8192`) from env
    - Implement `executePrompt(userMessage)`: build messages array with user prompt, include system prompt from SystemPromptManager, format MCP tools as Claude tool definitions, send to Anthropic Messages API
    - Implement conversation loop: on tool_use blocks call `McpClientService.callTool()` for each, append results to history, re-send; on text-only response return final text
    - Include `x-api-key` and `anthropic-version: 2023-06-01` headers
    - On tool call failure: include error message as tool result, continue loop
    - On Claude API HTTP error: return descriptive error with status code and message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3_

  - [ ]* 5.2 Write property test for Claude request composition (Property 3)
    - **Property 3: Claude request includes all required elements**
    - Generate random prompts, system prompts, and tool sets; mock fetch; capture request; verify all elements present
    - **Validates: Requirements 2.1, 2.5, 7.1**

  - [ ]* 5.3 Write property test for conversation loop tool execution (Property 4)
    - **Property 4: Conversation loop executes all tool-use blocks and feeds results back**
    - Generate Claude responses with random N tool-use blocks; mock MCP tool execution; verify follow-up request contains N tool results
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 5.4 Write property test for text-only response termination (Property 5)
    - **Property 5: Text-only response terminates conversation loop**
    - Generate Claude responses with only text blocks; verify loop returns text and makes no further API calls
    - **Validates: Requirements 2.4**

  - [ ]* 5.5 Write property test for HTTP error handling (Property 6)
    - **Property 6: HTTP errors produce descriptive error responses**
    - Generate random HTTP error status codes and error bodies; verify returned error contains both
    - **Validates: Requirements 2.6**

  - [ ]* 5.6 Write property test for environment config resolution (Property 9)
    - **Property 9: Environment configuration resolution with defaults**
    - Generate random env var combinations (present/absent); verify resolved config uses provided values or defaults
    - **Validates: Requirements 7.2, 7.3**

  - [x] 5.7 Write unit tests for ClaudeConversationClient
    - Mock fetch; test single-turn text response, multi-turn tool-use loop, Claude API error handling, tool call failure resilience, missing API key
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 7.1, 7.4_

- [x] 6. Implement MCP API routes
  - [x] 6.1 Create `packages/server/src/api/mcpRoutes.ts` with `createMcpRouter()` factory
    - POST `/api/mcp/start` — start MCP server, return status + tools; 409 if already running
    - POST `/api/mcp/stop` — stop MCP server, return confirmation
    - GET `/api/mcp/status` — return session status + tool list
    - POST `/api/mcp/prompt` — execute conversation loop, return response; 409 if disconnected; 503 if `ANTHROPIC_API_KEY` missing
    - GET `/api/mcp/system-prompt` — return current system prompt
    - PUT `/api/mcp/system-prompt` — update custom system prompt; 400 on validation failure
    - Use existing `ApiError` type for error responses
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 7.4_

  - [x] 6.2 Register MCP router in `packages/server/src/api/index.ts` and mount in `packages/server/src/index.ts`
    - Export `createMcpRouter` from api index
    - Mount at `/api/mcp` in the Express app
    - Instantiate McpClientService, SystemPromptManager, ClaudeConversationClient and wire them together
    - _Requirements: 4.1_

  - [x] 6.3 Write unit tests for mcpRoutes
    - Test each endpoint with mocked services
    - Test 409 conflict cases (start when running, prompt when disconnected)
    - Test 503 when API key missing
    - Test 400 on invalid system prompt
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 7. Checkpoint - Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Angular frontend MCP module
  - [x] 8.1 Create frontend types at `packages/web/src/app/mcp/models/mcp.models.ts`
    - Define `McpSessionStatus`, `McpTool`, `McpStatusResponse`, `McpPromptResponse`, `McpSystemPromptResponse`
    - _Requirements: 5.1, 5.4, 5.6, 5.7_

  - [x] 8.2 Create `packages/web/src/app/mcp/services/mcp.service.ts`
    - Injectable service with HttpClient calls to `/api/mcp/*`
    - Methods: `start()`, `stop()`, `getStatus()`, `sendPrompt(prompt)`, `getSystemPrompt()`, `updateSystemPrompt(prompt)`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 8.3 Create `packages/web/src/app/mcp/mcp-dashboard.component.ts` (and template/styles)
    - Connection status indicator (connected/disconnected)
    - Start/Stop buttons contextual on status
    - Tool list panel visible when connected
    - Prompt input area with submit button
    - Response display panel
    - System prompt editor with save button
    - Loading indicator during prompt execution, disable submit
    - Error notification area for API failures
    - Use Angular Material components consistent with existing dashboard
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 8.4 Create `packages/web/src/app/mcp/mcp.module.ts` and register lazy-loaded route
    - Lazy-loaded module following existing `DashboardModule` pattern
    - Register in `app.routes.ts` at path `mcp`
    - _Requirements: 5.1_

  - [x] 8.5 Write unit tests for McpDashboardComponent
    - Angular TestBed tests for component rendering
    - Button state based on connection status
    - Loading indicator during prompt execution
    - Error display on API failure
    - _Requirements: 5.1, 5.2, 5.3, 5.8, 5.9_

- [x] 9. Integration wiring and final validation
  - [x] 9.1 Add navigation link to MCP Dashboard in the app shell/sidebar
    - Add route link to the existing navigation consistent with other modules
    - _Requirements: 5.1_

  - [x] 9.2 Update `packages/server/.env` with placeholder MCP environment variables
    - Add `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_MAX_TOKENS` placeholders with comments
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 9.3 Update `packages/server/src/config/validateEnv.ts` to include MCP-related env var warnings
    - Add optional warnings for missing `ANTHROPIC_API_KEY`
    - _Requirements: 7.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Update ClaudeConversationClient to use AI_PROVIDER_API_KEY
  - [ ] 11.1 Update `packages/server/src/services/ClaudeConversationClient.ts` environment variable references
    - Change `getApiKey()` to read from `AI_PROVIDER_API_KEY` instead of `ANTHROPIC_API_KEY`
    - Change `getModel()` to read from `AI_PROVIDER_MODEL` instead of `CLAUDE_MODEL`
    - Update the error message in `executePrompt()` to reference `AI_PROVIDER_API_KEY`
    - _Requirements: 2.6, 4.4, 9.1, 9.2_

  - [ ] 11.2 Update `packages/server/src/services/ClaudeConversationClient.test.ts` for new env vars
    - Change all `ANTHROPIC_API_KEY` references to `AI_PROVIDER_API_KEY` in `beforeEach` and test cases
    - Update the "missing API key" test descriptions and assertions to reference `AI_PROVIDER_API_KEY`
    - Update the request header assertion to verify `AI_PROVIDER_API_KEY` value in `x-api-key`
    - _Requirements: 2.6, 9.1_

- [ ] 12. Create McpClaudeProvider
  - [ ] 12.1 Create `packages/server/src/services/McpClaudeProvider.ts`
    - Implement `AIProvider` interface with `generateChanges(request: AIProviderRequest): Promise<AIProviderResponse>`
    - Constructor takes `McpClientService` and `ClaudeConversationClient`
    - Build prompt from `AIProviderRequest` using `buildSystemPromptText()` and `buildUserPromptText()` from `AIProvider.ts`
    - When MCP connected: delegate to `ClaudeConversationClient.executePrompt()` for conversation loop with tools
    - When MCP disconnected: fall back to single-shot Claude API call without MCP tool definitions
    - Parse final text response using `parseAIResponse()` from `AIProvider.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [ ] 12.2 Export `McpClaudeProvider` from `packages/server/src/services/index.ts`
    - Add export statement for the new class
    - _Requirements: 2.1_

  - [ ]* 12.3 Write unit tests for McpClaudeProvider
    - Mock `ClaudeConversationClient` and `McpClientService`
    - Test `generateChanges()` with MCP connected (conversation loop path)
    - Test `generateChanges()` with MCP disconnected (single-shot fallback)
    - Test response parsing via `parseAIResponse()`
    - _Requirements: 2.1, 2.5, 2.7_

  - [ ]* 12.4 Write property test for McpClaudeProvider response parsing (Property 10)
    - **Property 10: McpClaudeProvider response parsing**
    - Generate random valid `AIProviderResponse` objects, serialize to JSON, wrap in markdown code block, parse with `parseAIResponse()`, verify round-trip
    - **Validates: Requirements 2.5**

  - [ ]* 12.5 Write property test for McpClaudeProvider fallback without MCP (Property 11)
    - **Property 11: McpClaudeProvider fallback without MCP**
    - Generate random `AIProviderRequest` objects with MCP disconnected; verify `generateChanges()` produces a valid `AIProviderResponse` without tool definitions in the Claude request
    - **Validates: Requirements 2.7**

- [ ] 13. Update index.ts wiring for claude-mcp provider
  - [ ] 13.1 Add `claude-mcp` case to `AI_PROVIDER_TYPE` switch in `packages/server/src/index.ts`
    - Import `McpClaudeProvider`
    - When `aiProviderType === 'claude-mcp'`: auto-start MCP server via `mcpClient.start()`, create `SystemPromptManager` and `ClaudeConversationClient`, instantiate `McpClaudeProvider` as the `aiProvider`
    - Share the `McpClientService` singleton between `McpClaudeProvider` and `createMcpRouter()`
    - Move `mcpClient` creation before the AI provider switch so it can be used in both the provider and the router
    - _Requirements: 4.1, 4.2, 4.3, 1.8_

- [ ] 14. Update validateEnv.ts for claude-mcp
  - [ ] 14.1 Update `packages/server/src/config/validateEnv.ts`
    - Add `'claude-mcp'` to the `SUPPORTED_AI_PROVIDERS` array
    - Remove the `ANTHROPIC_API_KEY` warning (all Claude auth now uses `AI_PROVIDER_API_KEY`)
    - _Requirements: 4.3, 9.5_

- [ ] 15. Update mcpRoutes.ts API key check
  - [ ] 15.1 Update `packages/server/src/api/mcpRoutes.ts` prompt endpoint
    - Change `process.env.ANTHROPIC_API_KEY` check to `process.env.AI_PROVIDER_API_KEY` in the POST `/prompt` handler
    - Update the error message to reference `AI_PROVIDER_API_KEY`
    - _Requirements: 9.4_

- [ ] 16. Checkpoint - Ensure all tests pass after env var migration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Update .env and test files for unified env vars
  - [ ] 17.1 Update `packages/server/.env`
    - Remove the `ANTHROPIC_API_KEY` placeholder line
    - Add `claude-mcp` as a documented option in the `AI_PROVIDER_TYPE` comment
    - _Requirements: 9.1, 9.5_

  - [ ] 17.2 Update `packages/server/src/api/mcpRoutes.test.ts` for AI_PROVIDER_API_KEY
    - Change all `ANTHROPIC_API_KEY` references to `AI_PROVIDER_API_KEY` in env setup/teardown and assertions
    - Update the "returns 503 when API key missing" test to delete `AI_PROVIDER_API_KEY` instead of `ANTHROPIC_API_KEY`
    - _Requirements: 9.4_

- [ ] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Server-side implementation is completed before frontend to ensure API contracts are stable
- Tasks 11-18 add the McpClaudeProvider integration and unify environment variables under AI_PROVIDER_API_KEY
