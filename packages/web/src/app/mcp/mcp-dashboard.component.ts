import { Component, OnInit } from '@angular/core';
import { McpService } from './services/mcp.service';
import {
  McpSessionStatus,
  McpTool,
} from './models/mcp.models';

@Component({
  selector: 'app-mcp-dashboard',
  template: `
    <div class="mcp-page">
      <header class="mcp-header">
        <div class="header-inner">
          <div class="header-left">
            <a routerLink="/" class="back-link">
              <mat-icon class="back-icon">arrow_back</mat-icon>
              <span>Repository Dashboard</span>
            </a>
          </div>
          <div class="header-center">
            <div class="logo-glyph">
              <mat-icon class="logo-icon">memory</mat-icon>
              <span class="logo-pulse"></span>
            </div>
            <div>
              <h1 class="header-title">MCP Console</h1>
              <p class="header-subtitle">Claude &times; Angular CLI</p>
            </div>
          </div>
          <div class="header-right">
            <span class="status-chip" [class.connected]="status === 'connected'" [class.disconnected]="status === 'disconnected'">
              <span class="status-dot"></span>
              {{ status === 'connected' ? 'Online' : 'Offline' }}
            </span>
          </div>
        </div>
      </header>

      <!-- Error notification area -->
      <div *ngIf="error" class="error-bar" (click)="error = null">
        <mat-icon class="error-bar-icon">error_outline</mat-icon>
        <span class="error-bar-text">{{ error }}</span>
        <mat-icon class="error-bar-close">close</mat-icon>
      </div>

      <main class="mcp-content">
        <!-- Connection control card -->
        <mat-card class="mcp-card control-card">
          <div class="card-label">Session Control</div>
          <div class="control-row">
            <div class="control-status">
              <div class="status-ring" [class.active]="status === 'connected'">
                <mat-icon class="status-ring-icon">{{ status === 'connected' ? 'link' : 'link_off' }}</mat-icon>
              </div>
              <div class="status-info">
                <span class="status-label">MCP Server</span>
                <span class="status-value" [class.on]="status === 'connected'">{{ status === 'connected' ? 'Connected' : 'Disconnected' }}</span>
              </div>
            </div>
            <div class="control-actions">
              <button
                mat-raised-button
                class="btn-start"
                *ngIf="status === 'disconnected'"
                [disabled]="statusLoading"
                (click)="onStart()">
                <mat-icon>play_arrow</mat-icon>
                <span>Start Server</span>
                <mat-spinner *ngIf="statusLoading" diameter="18" class="btn-spinner"></mat-spinner>
              </button>
              <button
                mat-raised-button
                class="btn-stop"
                *ngIf="status === 'connected'"
                [disabled]="statusLoading"
                (click)="onStop()">
                <mat-icon>stop</mat-icon>
                <span>Stop Server</span>
                <mat-spinner *ngIf="statusLoading" diameter="18" class="btn-spinner"></mat-spinner>
              </button>
            </div>
          </div>
        </mat-card>

        <!-- Tools panel (visible when connected) -->
        <mat-card class="mcp-card tools-card" *ngIf="status === 'connected' && tools.length > 0">
          <div class="card-label">Discovered Tools</div>
          <mat-accordion>
            <mat-expansion-panel *ngFor="let tool of tools; let i = index" class="tool-panel">
              <mat-expansion-panel-header>
                <mat-panel-title class="tool-title">
                  <mat-icon class="tool-icon">build_circle</mat-icon>
                  {{ tool.name }}
                </mat-panel-title>
              </mat-expansion-panel-header>
              <p class="tool-description">{{ tool.description }}</p>
            </mat-expansion-panel>
          </mat-accordion>
        </mat-card>

        <div class="two-col">
          <!-- Prompt area -->
          <mat-card class="mcp-card prompt-card">
            <div class="card-label">Prompt</div>
            <mat-form-field appearance="outline" class="prompt-field">
              <mat-label>Ask Claude something&hellip;</mat-label>
              <textarea
                matInput
                [(ngModel)]="promptText"
                rows="5"
                class="prompt-textarea"
                [disabled]="loading"
              ></textarea>
            </mat-form-field>
            <div class="prompt-actions">
              <button
                mat-raised-button
                class="btn-send"
                [disabled]="loading || !promptText.trim() || status !== 'connected'"
                (click)="onSendPrompt()">
                <mat-icon>send</mat-icon>
                <span>Send</span>
                <mat-spinner *ngIf="loading" diameter="18" class="btn-spinner"></mat-spinner>
              </button>
            </div>
            <mat-progress-bar *ngIf="loading" mode="indeterminate" class="prompt-progress"></mat-progress-bar>
          </mat-card>

          <!-- System prompt editor -->
          <mat-card class="mcp-card system-card">
            <div class="card-label">System Prompt</div>
            <mat-form-field appearance="outline" class="system-field">
              <mat-label>System instructions for Claude</mat-label>
              <textarea
                matInput
                [(ngModel)]="systemPromptText"
                rows="5"
                class="system-textarea"
              ></textarea>
            </mat-form-field>
            <div class="prompt-actions">
              <button
                mat-raised-button
                class="btn-save"
                [disabled]="!systemPromptText.trim()"
                (click)="onSaveSystemPrompt()">
                <mat-icon>save</mat-icon>
                <span>Save</span>
              </button>
            </div>
          </mat-card>
        </div>

        <!-- Response display -->
        <mat-card class="mcp-card response-card" *ngIf="responseText">
          <div class="card-label">Response</div>
          <div class="response-body">{{ responseText }}</div>
        </mat-card>
      </main>
    </div>
  `,
  styles: [`
    /* ── Google Fonts import ── */
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

    /* ── CSS Variables — Cyberpunk / Terminal aesthetic ── */
    :host {
      --mcp-bg: #0c0e14;
      --mcp-surface: #13161f;
      --mcp-surface-raised: #1a1e2b;
      --mcp-border: rgba(56, 227, 198, 0.12);
      --mcp-border-subtle: rgba(255, 255, 255, 0.06);
      --mcp-neon: #38e3c6;
      --mcp-neon-dim: rgba(56, 227, 198, 0.15);
      --mcp-neon-glow: rgba(56, 227, 198, 0.35);
      --mcp-accent: #a78bfa;
      --mcp-accent-dim: rgba(167, 139, 250, 0.15);
      --mcp-danger: #f87171;
      --mcp-danger-dim: rgba(248, 113, 113, 0.12);
      --mcp-warn: #fbbf24;
      --mcp-text: #e2e8f0;
      --mcp-text-muted: #64748b;
      --mcp-text-dim: #475569;
      --mcp-font-display: 'Space Grotesk', sans-serif;
      --mcp-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
      --mcp-radius: 10px;
      --mcp-card-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 1px rgba(56, 227, 198, 0.1);
      display: block;
    }

    /* ── Page ── */
    .mcp-page {
      min-height: 100vh;
      background: var(--mcp-bg);
      background-image:
        radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56, 227, 198, 0.04) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(167, 139, 250, 0.03) 0%, transparent 50%);
      font-family: var(--mcp-font-display);
      color: var(--mcp-text);
    }

    /* ── Header ── */
    .mcp-header {
      background: linear-gradient(180deg, rgba(19, 22, 31, 0.95) 0%, rgba(12, 14, 20, 0.98) 100%);
      border-bottom: 1px solid var(--mcp-border);
      padding: 18px 0;
      position: relative;
      backdrop-filter: blur(12px);
    }

    .mcp-header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--mcp-neon) 50%, transparent 100%);
      opacity: 0.4;
    }

    .header-inner {
      max-width: 1260px;
      margin: 0 auto;
      padding: 0 28px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
    }

    .header-left { justify-self: start; }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mcp-text-muted);
      text-decoration: none;
      font-size: 13px;
      font-family: var(--mcp-font-display);
      letter-spacing: 0.3px;
      padding: 6px 12px;
      border-radius: 8px;
      transition: background 0.2s, color 0.2s;
    }

    .back-link:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--mcp-text);
    }

    .back-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .header-center {
      display: flex;
      align-items: center;
      gap: 14px;
      justify-self: center;
    }

    .logo-glyph {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: var(--mcp-neon);
      filter: drop-shadow(0 0 6px var(--mcp-neon-glow));
    }

    .logo-pulse {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 1.5px solid var(--mcp-neon);
      opacity: 0;
      animation: pulse-ring 2.5s ease-out infinite;
    }

    @keyframes pulse-ring {
      0% { opacity: 0.6; transform: scale(0.8); }
      100% { opacity: 0; transform: scale(1.6); }
    }

    .header-title {
      margin: 0;
      font-family: var(--mcp-font-display);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: var(--mcp-text);
    }

    .header-subtitle {
      margin: 1px 0 0;
      font-family: var(--mcp-font-mono);
      font-size: 11px;
      color: var(--mcp-text-muted);
      letter-spacing: 0.5px;
    }

    .header-right { justify-self: end; }

    /* ── Status chip ── */
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-family: var(--mcp-font-mono);
      font-size: 12px;
      font-weight: 500;
      padding: 5px 14px;
      border-radius: 20px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    .status-chip.connected {
      background: var(--mcp-neon-dim);
      color: var(--mcp-neon);
      border: 1px solid rgba(56, 227, 198, 0.25);
    }

    .status-chip.disconnected {
      background: var(--mcp-danger-dim);
      color: var(--mcp-danger);
      border: 1px solid rgba(248, 113, 113, 0.2);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 6px currentColor;
    }

    .status-chip.connected .status-dot {
      animation: blink-dot 2s ease-in-out infinite;
    }

    @keyframes blink-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ── Error bar ── */
    .error-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 1260px;
      margin: 12px auto 0;
      padding: 10px 18px;
      background: var(--mcp-danger-dim);
      border: 1px solid rgba(248, 113, 113, 0.25);
      border-radius: var(--mcp-radius);
      color: var(--mcp-danger);
      font-size: 13px;
      font-family: var(--mcp-font-mono);
      cursor: pointer;
      animation: slideDown 0.3s ease-out;
    }

    .error-bar-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .error-bar-text { flex: 1; }
    .error-bar-close { font-size: 18px; width: 18px; height: 18px; opacity: 0.6; }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Main content ── */
    .mcp-content {
      max-width: 1260px;
      margin: 0 auto;
      padding: 24px 28px 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: fadeUp 0.45s ease-out;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Cards ── */
    .mcp-card {
      background: var(--mcp-surface) !important;
      border: 1px solid var(--mcp-border-subtle) !important;
      border-radius: var(--mcp-radius) !important;
      box-shadow: var(--mcp-card-shadow) !important;
      padding: 22px 24px !important;
      position: relative;
      overflow: visible !important;
    }

    .card-label {
      font-family: var(--mcp-font-mono);
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--mcp-text-muted);
      margin-bottom: 16px;
    }

    /* ── Control card ── */
    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .control-status {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .status-ring {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--mcp-surface-raised);
      border: 2px solid var(--mcp-border-subtle);
      transition: border-color 0.4s, box-shadow 0.4s;
    }

    .status-ring.active {
      border-color: var(--mcp-neon);
      box-shadow: 0 0 16px var(--mcp-neon-dim);
    }

    .status-ring-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: var(--mcp-text-muted);
      transition: color 0.3s;
    }

    .status-ring.active .status-ring-icon {
      color: var(--mcp-neon);
    }

    .status-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .status-label {
      font-size: 12px;
      color: var(--mcp-text-muted);
      font-family: var(--mcp-font-mono);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .status-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--mcp-text-dim);
      transition: color 0.3s;
    }

    .status-value.on {
      color: var(--mcp-neon);
    }

    .control-actions {
      display: flex;
      gap: 10px;
    }

    /* ── Buttons ── */
    .btn-start, .btn-stop, .btn-send, .btn-save {
      font-family: var(--mcp-font-display) !important;
      font-weight: 600 !important;
      font-size: 13px !important;
      letter-spacing: 0.3px !important;
      border-radius: 8px !important;
      padding: 0 20px !important;
      height: 40px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      position: relative;
      transition: box-shadow 0.25s, transform 0.15s !important;
    }

    .btn-start {
      background: var(--mcp-neon) !important;
      color: #0c0e14 !important;
    }

    .btn-start:hover:not([disabled]) {
      box-shadow: 0 0 20px var(--mcp-neon-glow) !important;
      transform: translateY(-1px);
    }

    .btn-stop {
      background: var(--mcp-surface-raised) !important;
      color: var(--mcp-danger) !important;
      border: 1px solid rgba(248, 113, 113, 0.3) !important;
    }

    .btn-stop:hover:not([disabled]) {
      background: var(--mcp-danger-dim) !important;
    }

    .btn-send {
      background: var(--mcp-accent) !important;
      color: #0c0e14 !important;
    }

    .btn-send:hover:not([disabled]) {
      box-shadow: 0 0 20px var(--mcp-accent-dim) !important;
      transform: translateY(-1px);
    }

    .btn-save {
      background: var(--mcp-surface-raised) !important;
      color: var(--mcp-neon) !important;
      border: 1px solid var(--mcp-border) !important;
    }

    .btn-save:hover:not([disabled]) {
      background: var(--mcp-neon-dim) !important;
    }

    button[disabled] {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
    }

    .btn-spinner {
      position: absolute;
      right: 10px;
    }

    .btn-spinner ::ng-deep circle {
      stroke: currentColor !important;
    }

    /* ── Tools card ── */
    .tools-card {
      border-left: 3px solid var(--mcp-neon) !important;
      animation: fadeUp 0.35s ease-out;
    }

    .tool-panel {
      background: var(--mcp-surface-raised) !important;
      border: 1px solid var(--mcp-border-subtle) !important;
      border-radius: 8px !important;
      margin-bottom: 6px !important;
    }

    .tool-panel ::ng-deep .mat-expansion-panel-body {
      padding: 8px 20px 16px !important;
    }

    .tool-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--mcp-font-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--mcp-text);
    }

    .tool-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--mcp-neon);
    }

    .tool-description {
      font-size: 13px;
      color: var(--mcp-text-muted);
      line-height: 1.6;
      margin: 0;
      font-family: var(--mcp-font-display);
    }

    /* ── Two column layout ── */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    /* ── Prompt & System prompt cards ── */
    .prompt-field, .system-field {
      width: 100%;
    }

    .prompt-field ::ng-deep .mat-mdc-text-field-wrapper,
    .system-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: var(--mcp-surface-raised) !important;
      border-radius: 8px !important;
    }

    .prompt-field ::ng-deep .mdc-notched-outline__leading,
    .prompt-field ::ng-deep .mdc-notched-outline__notch,
    .prompt-field ::ng-deep .mdc-notched-outline__trailing,
    .system-field ::ng-deep .mdc-notched-outline__leading,
    .system-field ::ng-deep .mdc-notched-outline__notch,
    .system-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: var(--mcp-border-subtle) !important;
    }

    .prompt-field ::ng-deep .mat-mdc-form-field-focus-indicator,
    .system-field ::ng-deep .mat-mdc-form-field-focus-indicator {
      display: none;
    }

    .prompt-field ::ng-deep textarea,
    .system-field ::ng-deep textarea {
      font-family: var(--mcp-font-mono) !important;
      font-size: 13px !important;
      color: var(--mcp-text) !important;
      line-height: 1.6 !important;
    }

    .prompt-field ::ng-deep .mat-mdc-floating-label,
    .system-field ::ng-deep .mat-mdc-floating-label {
      color: var(--mcp-text-dim) !important;
      font-family: var(--mcp-font-display) !important;
    }

    .prompt-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }

    .prompt-progress {
      margin-top: 12px;
      border-radius: 4px;
      overflow: hidden;
    }

    .prompt-progress ::ng-deep .mdc-linear-progress__bar-inner {
      border-color: var(--mcp-accent) !important;
    }

    .prompt-progress ::ng-deep .mdc-linear-progress__buffer-bar {
      background-color: var(--mcp-accent-dim) !important;
    }

    /* ── Response card ── */
    .response-card {
      border-left: 3px solid var(--mcp-accent) !important;
      animation: fadeUp 0.35s ease-out;
    }

    .response-body {
      font-family: var(--mcp-font-mono);
      font-size: 13px;
      line-height: 1.75;
      color: var(--mcp-text);
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--mcp-surface-raised);
      padding: 16px 20px;
      border-radius: 8px;
      border: 1px solid var(--mcp-border-subtle);
      max-height: 400px;
      overflow-y: auto;
    }

    .response-body::-webkit-scrollbar {
      width: 6px;
    }

    .response-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .response-body::-webkit-scrollbar-thumb {
      background: var(--mcp-text-dim);
      border-radius: 3px;
    }

    /* ── Expansion panel overrides ── */
    .tools-card ::ng-deep .mat-expansion-panel-header-title {
      color: var(--mcp-text) !important;
    }

    .tools-card ::ng-deep .mat-expansion-indicator::after {
      color: var(--mcp-text-muted) !important;
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .header-inner {
        grid-template-columns: 1fr;
        text-align: center;
        gap: 10px;
      }

      .header-left,
      .header-center,
      .header-right {
        justify-self: center;
      }

      .control-row {
        flex-direction: column;
        align-items: flex-start;
      }

      .two-col {
        grid-template-columns: 1fr;
      }

      .mcp-content {
        padding: 16px 12px 32px;
      }
    }
  `],
})
export class McpDashboardComponent implements OnInit {
  status: McpSessionStatus = 'disconnected';
  tools: McpTool[] = [];
  promptText = '';
  responseText = '';
  systemPromptText = '';
  loading = false;
  statusLoading = false;
  error: string | null = null;

  constructor(private readonly mcpService: McpService) {}

  ngOnInit(): void {
    this.mcpService.getStatus().subscribe({
      next: (res) => {
        this.status = res.status;
        this.tools = res.tools;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to fetch MCP status.';
      },
    });

    this.mcpService.getSystemPrompt().subscribe({
      next: (res) => {
        this.systemPromptText = res.prompt;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to load system prompt.';
      },
    });
  }

  onStart(): void {
    this.statusLoading = true;
    this.error = null;
    this.mcpService.start().subscribe({
      next: (res) => {
        this.status = res.status;
        this.tools = res.tools;
        this.statusLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to start MCP server.';
        this.statusLoading = false;
      },
    });
  }

  onStop(): void {
    this.statusLoading = true;
    this.error = null;
    this.mcpService.stop().subscribe({
      next: () => {
        this.status = 'disconnected';
        this.tools = [];
        this.statusLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to stop MCP server.';
        this.statusLoading = false;
      },
    });
  }

  onSendPrompt(): void {
    if (!this.promptText.trim() || this.status !== 'connected') return;
    this.loading = true;
    this.error = null;
    this.responseText = '';
    this.mcpService.sendPrompt(this.promptText).subscribe({
      next: (res) => {
        this.responseText = res.response;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to execute prompt.';
        this.loading = false;
      },
    });
  }

  onSaveSystemPrompt(): void {
    if (!this.systemPromptText.trim()) return;
    this.error = null;
    this.mcpService.updateSystemPrompt(this.systemPromptText).subscribe({
      next: () => {
        // Saved successfully — no-op, the text is already in the editor
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to save system prompt.';
      },
    });
  }
}
