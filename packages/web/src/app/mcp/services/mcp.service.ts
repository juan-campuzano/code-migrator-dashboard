import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  McpStatusResponse,
  McpPromptResponse,
  McpSystemPromptResponse,
} from '../models/mcp.models';

@Injectable()
export class McpService {
  private readonly apiBase = '/api/mcp';

  constructor(private readonly http: HttpClient) {}

  start(): Observable<McpStatusResponse> {
    return this.http.post<McpStatusResponse>(`${this.apiBase}/start`, {});
  }

  stop(): Observable<void> {
    return this.http.post<void>(`${this.apiBase}/stop`, {});
  }

  getStatus(): Observable<McpStatusResponse> {
    return this.http.get<McpStatusResponse>(`${this.apiBase}/status`);
  }

  sendPrompt(prompt: string): Observable<McpPromptResponse> {
    return this.http.post<McpPromptResponse>(`${this.apiBase}/prompt`, { prompt });
  }

  getSystemPrompt(): Observable<McpSystemPromptResponse> {
    return this.http.get<McpSystemPromptResponse>(`${this.apiBase}/system-prompt`);
  }

  updateSystemPrompt(prompt: string): Observable<void> {
    return this.http.put<void>(`${this.apiBase}/system-prompt`, { prompt });
  }
}
