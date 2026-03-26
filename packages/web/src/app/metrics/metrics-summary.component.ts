import { Component, OnInit } from '@angular/core';
import { MetricsService } from './services/metrics.service';
import { MetricsSummaryResponse } from './models/metrics.models';

@Component({
  selector: 'app-metrics-summary',
  template: `
    <div class="metrics-page">
      <header class="metrics-header">
        <div class="header-inner">
          <div class="header-left">
            <a routerLink="/" class="back-link">
              <mat-icon class="back-icon">arrow_back</mat-icon>
              <span>Repository Dashboard</span>
            </a>
          </div>
          <div class="header-center">
            <mat-icon class="header-logo">insights</mat-icon>
            <div>
              <h1 class="header-title">Portfolio Metrics</h1>
              <p class="header-subtitle">Aggregate health across all repositories</p>
            </div>
          </div>
          <div class="header-right"></div>
        </div>
      </header>

      <!-- Loading State -->
      <div *ngIf="loading" class="state-container loading-state">
        <mat-progress-spinner
          mode="indeterminate"
          diameter="52"
          strokeWidth="4"
          color="primary"
        ></mat-progress-spinner>
        <p class="state-text">Loading portfolio metrics&hellip;</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="state-container error-state">
        <mat-icon class="state-icon error-icon">cloud_off</mat-icon>
        <p class="state-text">Failed to load metrics summary. Please try again.</p>
        <button mat-raised-button color="primary" class="retry-btn" (click)="retry()">
          <mat-icon>refresh</mat-icon>
          Retry
        </button>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && !error && summary && summary.totalRepositories === 0" class="state-container empty-state">
        <mat-icon class="state-icon empty-icon">inventory_2</mat-icon>
        <p class="state-text">No repositories found. Ingest a repository to get started.</p>
        <a mat-raised-button color="primary" routerLink="/" class="home-link-btn">
          <mat-icon>home</mat-icon>
          Go to Dashboard
        </a>
      </div>

      <!-- Data Loaded -->
      <main *ngIf="!loading && !error && summary && summary.totalRepositories > 0" class="metrics-content">
        <div class="top-row">
          <app-portfolio-score
            [portfolioGrade]="summary.portfolioGrade"
            [portfolioScore]="summary.portfolioScore"
            [totalRepositories]="summary.totalRepositories"
            [loading]="false"
          ></app-portfolio-score>
          <app-grade-distribution
            [repositories]="summary.repositories"
          ></app-grade-distribution>
        </div>

        <app-repository-table
          [repositories]="summary.repositories"
        ></app-repository-table>

        <app-language-chart
          [languageDistribution]="summary.languageDistribution"
        ></app-language-chart>
      </main>
    </div>
  `,
  styles: [`
    /* ── CSS Variables ── */
    :host {
      --ms-bg: #faf8f5;
      --ms-header-from: #1a3c34;
      --ms-header-to: #2e7d68;
      --ms-accent: #d4a24e;
      --ms-accent-light: #f5e6c8;
      --ms-text: #2c2c2c;
      --ms-text-muted: #7a7a72;
      --ms-card-bg: #ffffff;
      --ms-card-shadow: 0 2px 16px rgba(30, 60, 52, 0.07);
      --ms-radius: 14px;
      --ms-font-display: 'DM Serif Display', Georgia, serif;
      --ms-font-body: 'DM Sans', 'Segoe UI', sans-serif;
      display: block;
    }

    /* ── Page ── */
    .metrics-page {
      min-height: 100vh;
      background: var(--ms-bg);
      font-family: var(--ms-font-body);
      color: var(--ms-text);
    }

    /* ── Header ── */
    .metrics-header {
      background: linear-gradient(135deg, var(--ms-header-from) 0%, var(--ms-header-to) 100%);
      padding: 22px 0 20px;
      color: #fff;
      position: relative;
      overflow: hidden;
    }

    .metrics-header::before {
      content: '';
      position: absolute;
      top: -40%;
      right: -10%;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(212, 162, 78, 0.12) 0%, transparent 70%);
      pointer-events: none;
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

    .header-left {
      justify-self: start;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: rgba(255, 255, 255, 0.82);
      text-decoration: none;
      font-size: 13px;
      font-family: var(--ms-font-body);
      letter-spacing: 0.2px;
      padding: 6px 12px;
      border-radius: 8px;
      transition: background 0.2s, color 0.2s;
    }

    .back-link:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
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

    .header-logo {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.85;
      color: var(--ms-accent);
    }

    .header-title {
      margin: 0;
      font-family: var(--ms-font-display);
      font-size: 22px;
      font-weight: 400;
      letter-spacing: 0.3px;
    }

    .header-subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      opacity: 0.65;
      font-weight: 400;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    .header-right {
      justify-self: end;
    }

    /* ── State containers ── */
    .state-container {
      max-width: 480px;
      margin: 80px auto;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      animation: fadeUp 0.4s ease-out;
    }

    .state-icon {
      font-size: 52px;
      width: 52px;
      height: 52px;
    }

    .error-icon {
      color: #c0392b;
    }

    .empty-icon {
      color: var(--ms-text-muted);
    }

    .state-text {
      font-size: 15px;
      color: var(--ms-text-muted);
      line-height: 1.5;
      margin: 0;
    }

    .retry-btn,
    .home-link-btn {
      margin-top: 4px;
      font-family: var(--ms-font-body);
      letter-spacing: 0.3px;
      border-radius: 8px;
      text-decoration: none;
    }

    /* ── Loading spinner ── */
    .loading-state {
      padding-top: 120px;
    }

    /* ── Main content ── */
    .metrics-content {
      max-width: 1260px;
      margin: 0 auto;
      padding: 24px 28px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: fadeUp 0.45s ease-out;
    }

    .top-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    /* ── Animations ── */
    @keyframes fadeUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .header-inner {
        grid-template-columns: 1fr;
        text-align: center;
        gap: 8px;
      }

      .header-left,
      .header-center,
      .header-right {
        justify-self: center;
      }

      .top-row {
        grid-template-columns: 1fr;
      }

      .metrics-content {
        padding: 16px 12px 32px;
      }
    }
  `],
})
export class MetricsSummaryComponent implements OnInit {
  summary: MetricsSummaryResponse | null = null;
  loading = false;
  error = false;

  constructor(private readonly metricsService: MetricsService) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  retry(): void {
    this.loadSummary();
  }

  private loadSummary(): void {
    this.loading = true;
    this.error = false;
    this.metricsService.getSummary().subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }
}
