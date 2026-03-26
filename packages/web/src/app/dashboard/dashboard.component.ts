import { Component } from '@angular/core';
import { RepositoryService } from './services/repository.service';
import {
  IngestionRecord,
  RepositoryLanguage,
  RepositoryFramework,
  FreshnessResponse,
} from './models/repository.models';
import { ScanError } from './components/error-banner/error-banner.component';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="page-wrapper">
      <header class="page-header">
        <div class="header-inner">
          <div class="header-left">
            <mat-icon class="header-logo">hub</mat-icon>
            <div>
              <h1 class="header-title">Repository Dashboard</h1>
              <p class="header-subtitle">Scan, analyze and manage your repositories</p>
            </div>
          </div>
          <div class="header-nav">
            <a class="metrics-nav-link" routerLink="/metrics">
              <mat-icon class="metrics-nav-icon">insights</mat-icon>
              Metrics Overview
            </a>
            <a class="metrics-nav-link" routerLink="/mcp">
              <mat-icon class="metrics-nav-icon">memory</mat-icon>
              MCP Console
            </a>
          </div>
        </div>
      </header>

      <main class="dashboard-container">
        <!-- Top action row: selector + ingestion side by side -->
        <div class="action-row">
          <mat-card class="action-card selector-card">
            <mat-card-content>
              <div class="action-card-header">
                <mat-icon class="action-icon selector-icon">folder_open</mat-icon>
                <span class="action-label">Browse Repository</span>
              </div>
              <app-repository-selector
                [autoSelectId]="autoSelectRepositoryId"
                (selectionChange)="onRepositorySelected($event)"
              ></app-repository-selector>
            </mat-card-content>
          </mat-card>

          <mat-card class="action-card ingest-card">
            <mat-card-content>
              <div class="action-card-header">
                <mat-icon class="action-icon ingest-icon">cloud_upload</mat-icon>
                <span class="action-label">Ingest Repository</span>
              </div>
              <app-ingestion-form (ingestionTriggered)="onIngestionTriggered($event)"></app-ingestion-form>
            </mat-card-content>
          </mat-card>
        </div>

        <p *ngIf="!ingestionId && !repositoryId" class="empty-prompt">
          <mat-icon class="empty-icon">search</mat-icon>
          Select a repository above or ingest a new one to get started
        </p>

        <mat-card *ngIf="ingestionId" class="dashboard-card status-card">
          <mat-card-content>
            <app-ingestion-status
              [ingestionId]="ingestionId"
              (ingestionCompleted)="onIngestionCompleted($event)"
            ></app-ingestion-status>
          </mat-card-content>
        </mat-card>

        <mat-card *ngIf="errors" class="dashboard-card error-card">
          <mat-card-content>
            <app-error-banner [errors]="errors"></app-error-banner>
          </mat-card-content>
        </mat-card>

        <!-- Metadata panels in a 2-column grid -->
        <div class="metrics-grid">
          <mat-card class="dashboard-card metric-card lang-card">
            <app-language-summary [languages]="languages" [loading]="loadingMetadata"></app-language-summary>
          </mat-card>
          <mat-card class="dashboard-card metric-card fw-card">
            <app-framework-list [frameworks]="frameworks" [loading]="loadingMetadata"></app-framework-list>
          </mat-card>
        </div>

        <div class="freshness-section" *ngIf="repositoryId">
          <app-freshness-grade
            [grade]="freshnessData?.grade ?? null"
            [weightedAverage]="freshnessData?.weightedAverage ?? null"
            [computedAt]="freshnessData?.computedAt ?? null"
            [loading]="loadingFreshness"
            (refresh)="onRefreshFreshness()">
          </app-freshness-grade>
          <app-freshness-table
            [dependencies]="freshnessData?.dependencies ?? null"
            [loading]="loadingFreshness">
          </app-freshness-table>
        </div>

        <!-- Settings row -->
        <div class="settings-grid">
          <mat-card class="dashboard-card settings-card">
            <app-token-settings></app-token-settings>
          </mat-card>
          <mat-card class="dashboard-card settings-card">
            <app-migration-trigger [repositoryId]="repositoryId"></app-migration-trigger>
          </mat-card>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .page-wrapper {
      min-height: 100vh;
      background: #f0f2f5;
    }

    /* ── Header ── */
    .page-header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
      padding: 28px 0 24px;
      color: #fff;
    }

    .header-inner {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-logo {
      font-size: 36px;
      width: 36px;
      height: 36px;
      opacity: 0.9;
    }

    .header-title {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }

    .header-subtitle {
      margin: 2px 0 0;
      font-size: 13px;
      opacity: 0.75;
      font-weight: 400;
    }

    /* ── Header nav ── */
    .header-nav {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* ── Metrics nav link ── */
    .metrics-nav-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: rgba(255, 255, 255, 0.88);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.3px;
      padding: 7px 16px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.08);
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      cursor: pointer;
      white-space: nowrap;
    }

    .metrics-nav-link:hover {
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.45);
      color: #fff;
    }

    .metrics-nav-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      opacity: 0.9;
    }

    /* ── Main container ── */
    .dashboard-container {
      max-width: 1240px;
      margin: -12px auto 32px;
      padding: 0 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ── Action row ── */
    .action-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 0;
    }

    .action-card {
      border-radius: 12px;
      border: none;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }

    .action-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .action-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .selector-icon { color: #2d6a9f; }
    .ingest-icon   { color: #e8734a; }

    .action-label {
      font-size: 14px;
      font-weight: 600;
      color: #37474f;
      letter-spacing: 0.1px;
    }

    /* ── Dashboard cards ── */
    .dashboard-card {
      border-radius: 12px;
      border: none;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }

    /* ── Metrics grid ── */
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .metric-card {
      overflow: hidden;
    }

    .lang-card {
      border-top: 3px solid #4db6ac;
    }

    .fw-card {
      border-top: 3px solid #7986cb;
    }

    /* ── Freshness section ── */
    .freshness-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ── Settings grid ── */
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .settings-card {
      border-top: 3px solid #90a4ae;
    }

    /* ── Empty prompt ── */
    .empty-prompt {
      text-align: center;
      color: #78909c;
      padding: 40px 0;
      font-size: 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #b0bec5;
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .action-row,
      .metrics-grid,
      .settings-grid {
        grid-template-columns: 1fr;
      }

      .header-title { font-size: 18px; }
      .header-subtitle { display: none; }
      .dashboard-container { padding: 0 12px; }
    }

    /* ── Global overrides for child components ── */
    :host ::ng-deep .mat-body-medium,
    :host ::ng-deep .mat-mdc-cell {
      font-size: max(var(--mat-sys-body-medium-size, 14px), 14px);
    }

    :host ::ng-deep .mat-mdc-card {
      border-radius: 12px;
    }
  `],
})
export class DashboardComponent {
  ingestionId: string | null = null;
  repositoryId: string | null = null;
  autoSelectRepositoryId: string | null = null;
  languages: RepositoryLanguage[] | null = null;
  frameworks: RepositoryFramework[] | null = null;
  errors: ScanError[] | null = null;
  loadingMetadata = false;
  freshnessData: FreshnessResponse | null = null;
  loadingFreshness = false;

  constructor(private readonly repositoryService: RepositoryService) {}

  onIngestionTriggered(ingestionId: string): void {
    this.ingestionId = ingestionId;
  }

  onIngestionCompleted(record: IngestionRecord): void {
    if (record.status !== 'completed' || !record.repositoryId) {
      return;
    }

    this.repositoryId = record.repositoryId;
    this.autoSelectRepositoryId = record.repositoryId;
    this.fetchMetadata(record.repositoryId);
  }

  onRepositorySelected(repositoryId: string): void {
    this.repositoryId = repositoryId;
    this.fetchMetadata(repositoryId);
  }

  private fetchMetadata(repositoryId: string): void {
    this.loadingMetadata = true;
    this.repositoryService.getRepositoryMetadata(repositoryId).subscribe({
      next: (metadata) => {
        this.languages = metadata.languages;
        this.frameworks = metadata.frameworks;
        this.errors = null;
        this.loadingMetadata = false;
      },
      error: () => {
        this.errors = [{ file: 'metadata', message: 'Failed to fetch repository metadata.' }];
        this.loadingMetadata = false;
      },
    });
    this.fetchFreshness(repositoryId);
  }

  private fetchFreshness(repositoryId: string): void {
    this.loadingFreshness = true;
    this.repositoryService.getFreshness(repositoryId).subscribe({
      next: (data) => {
        this.freshnessData = data;
        this.loadingFreshness = false;
      },
      error: () => {
        // 404 is expected for repos without scores
        this.freshnessData = null;
        this.loadingFreshness = false;
      },
    });
  }

  onRefreshFreshness(): void {
    if (!this.repositoryId) {
      return;
    }
    const repoId = this.repositoryId;
    this.loadingFreshness = true;
    this.repositoryService.refreshFreshness(repoId).subscribe({
      next: () => {
        // Wait briefly for scoring to complete, then re-fetch
        setTimeout(() => this.fetchFreshness(repoId), 2000);
      },
      error: () => {
        this.loadingFreshness = false;
      },
    });
  }
}
