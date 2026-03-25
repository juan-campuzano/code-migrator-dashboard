import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RepositoryGrade } from '../../models/repository.models';

@Component({
  selector: 'app-freshness-grade',
  template: `
    <div class="freshness-card">
      <div class="card-header">
        <div class="header-left">
          <mat-icon class="section-icon">verified</mat-icon>
          <h3>Freshness Score</h3>
        </div>
        <button
          mat-icon-button
          class="refresh-btn"
          (click)="refresh.emit()"
          [disabled]="loading"
          aria-label="Refresh freshness scores">
          <mat-icon [class.spinning]="loading">autorenew</mat-icon>
        </button>
      </div>

      <div *ngIf="loading" class="loading-state">
        <mat-spinner diameter="40" color="accent"></mat-spinner>
        <span class="loading-text">Computing scores…</span>
      </div>

      <div *ngIf="!loading && !grade" class="empty-state">
        <mat-icon>query_stats</mat-icon>
        <p>Freshness scores have not been computed yet</p>
      </div>

      <div *ngIf="!loading && grade" class="score-display">
        <div class="grade-badge" [ngClass]="'grade-' + grade">
          <span class="grade-letter">{{ grade }}</span>
        </div>
        <div class="score-details">
          <div class="percentage-row">
            <span class="percentage-value">{{ weightedAverage | number:'1.1-1' }}%</span>
            <span class="percentage-label">weighted average</span>
          </div>
          <div class="timestamp-row" *ngIf="computedAt">
            <mat-icon class="timestamp-icon">schedule</mat-icon>
            <span class="timestamp-text">{{ formatTimestamp(computedAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --grade-a: #0d9f6e;
      --grade-a-bg: rgba(13, 159, 110, 0.08);
      --grade-b: #5fa843;
      --grade-b-bg: rgba(95, 168, 67, 0.08);
      --grade-c: #c5a332;
      --grade-c-bg: rgba(197, 163, 50, 0.08);
      --grade-d: #d4712a;
      --grade-d-bg: rgba(212, 113, 42, 0.08);
      --grade-e: #c93b3b;
      --grade-e-bg: rgba(201, 59, 59, 0.08);
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --surface: #f8fafc;
      --border: #e2e8f0;
    }

    .freshness-card {
      padding: 20px 24px;
      border-radius: 10px;
      background: var(--surface);
      border: 1px solid var(--border);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-left h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .section-icon {
      color: #6366f1;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .refresh-btn {
      color: var(--text-secondary);
      transition: color 0.2s ease, transform 0.2s ease;
    }

    .refresh-btn:hover:not([disabled]) {
      color: #6366f1;
      transform: rotate(45deg);
    }

    .refresh-btn[disabled] {
      color: var(--text-muted);
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    /* Loading state */
    .loading-state {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 0;
    }

    .loading-text {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 16px;
      color: var(--text-muted);
    }

    .empty-state mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 10px;
      opacity: 0.6;
    }

    .empty-state p {
      margin: 0;
      font-size: 13px;
      font-weight: 500;
    }

    /* Score display */
    .score-display {
      display: flex;
      align-items: center;
      gap: 24px;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Grade badge */
    .grade-badge {
      width: 72px;
      height: 72px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    .grade-badge:hover {
      transform: scale(1.05);
    }

    .grade-letter {
      font-size: 36px;
      font-weight: 800;
      font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Menlo', monospace;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .grade-A {
      background: var(--grade-a-bg);
      border: 2px solid var(--grade-a);
    }
    .grade-A .grade-letter { color: var(--grade-a); }

    .grade-B {
      background: var(--grade-b-bg);
      border: 2px solid var(--grade-b);
    }
    .grade-B .grade-letter { color: var(--grade-b); }

    .grade-C {
      background: var(--grade-c-bg);
      border: 2px solid var(--grade-c);
    }
    .grade-C .grade-letter { color: var(--grade-c); }

    .grade-D {
      background: var(--grade-d-bg);
      border: 2px solid var(--grade-d);
    }
    .grade-D .grade-letter { color: var(--grade-d); }

    .grade-E {
      background: var(--grade-e-bg);
      border: 2px solid var(--grade-e);
    }
    .grade-E .grade-letter { color: var(--grade-e); }

    /* Score details */
    .score-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .percentage-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .percentage-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Menlo', monospace;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    .percentage-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .timestamp-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .timestamp-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--text-muted);
    }

    .timestamp-text {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 400;
    }
  `],
})
export class FreshnessGradeComponent {
  @Input() grade: RepositoryGrade | null = null;
  @Input() weightedAverage: number | null = null;
  @Input() computedAt: string | null = null;
  @Input() loading = false;

  @Output() refresh = new EventEmitter<void>();

  formatTimestamp(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}
