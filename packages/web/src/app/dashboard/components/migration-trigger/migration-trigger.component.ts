import { Component, Input, OnDestroy } from '@angular/core';
import { MigrationService } from '../../services/migration.service';
import { MigrationStatus } from '../../models/repository.models';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-migration-trigger',
  template: `
    <div class="migration-trigger">
      <div class="section-header">
        <mat-icon class="section-icon">swap_horiz</mat-icon>
        <h3>Migration</h3>
      </div>

      <div class="migration-form" *ngIf="!migrationId">
        <div class="form-row">
          <div class="field-group">
            <label class="field-label" for="migrationType">Migration Type</label>
            <div class="select-container">
              <select
                id="migrationType"
                class="native-select"
                [(ngModel)]="migrationType"
                name="migrationType"
                aria-label="Migration type"
                required
                (ngModelChange)="onMigrationTypeChange()"
              >
                <option value="" disabled selected>Select type…</option>
                <option value="ai-upgrade">AI Upgrade</option>
                <option value="framework_upgrade">Framework Upgrade</option>
                <option value="dependency_migration">Dependency Migration</option>
              </select>
              <mat-icon class="select-arrow">expand_more</mat-icon>
            </div>
          </div>

          <div class="field-group" *ngIf="migrationType !== 'ai-upgrade'">
            <label class="field-label" for="migrationParams">Parameters (optional)</label>
            <input
              id="migrationParams"
              type="text"
              class="native-input"
              [(ngModel)]="parametersInput"
              name="migrationParams"
              placeholder="e.g. targetVersion=2.0"
              aria-label="Migration parameters"
            />
          </div>
        </div>

        <div *ngIf="migrationType === 'ai-upgrade'" class="ai-upgrade-options">
          <div class="form-row">
            <div class="field-group">
              <label class="field-label">Upgrade Mode</label>
              <div class="select-container">
                <select
                  class="native-select"
                  [(ngModel)]="aiUpgradeMode"
                  name="aiUpgradeMode"
                  aria-label="Upgrade mode"
                >
                  <option value="all">Upgrade all outdated</option>
                  <option value="specific">Specific dependencies</option>
                </select>
                <mat-icon class="select-arrow">expand_more</mat-icon>
              </div>
            </div>
            <div class="field-group" *ngIf="aiUpgradeMode === 'specific'">
              <label class="field-label" for="aiDeps">Dependencies (comma-separated)</label>
              <input
                id="aiDeps"
                type="text"
                class="native-input"
                [(ngModel)]="aiDependenciesInput"
                name="aiDeps"
                placeholder="e.g. express, lodash"
                aria-label="Dependencies to upgrade"
              />
            </div>
          </div>
        </div>

        <button
          class="action-btn"
          type="button"
          (click)="triggerMigration()"
          [disabled]="!canTrigger()"
          [attr.title]="!repositoryId ? 'Select a repository first' : !migrationType ? 'Select a migration type' : loading ? 'Migration in progress' : 'Run migration'"
        >
          <mat-icon class="btn-icon">{{ loading ? 'hourglass_empty' : 'play_arrow' }}</mat-icon>
          {{ loading ? 'Triggering...' : !repositoryId ? 'Select a repository first' : 'Run Migration' }}
        </button>
      </div>

      <div class="migration-status" *ngIf="migrationId">
        <div class="status-row">
          <span class="status-label">ID:</span>
          <span class="status-value mono">{{ migrationId }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span class="status-badge" [class]="'badge-' + migrationStatus">{{ migrationStatus }}</span>
        </div>
        <div class="status-row" *ngIf="migrationResult">
          <span class="status-label">Result:</span>
          <span class="status-value">{{ migrationResult }}</span>
        </div>
        <div *ngIf="migrationError" class="error-message" role="alert">{{ migrationError }}</div>
        <button class="action-btn secondary" type="button" (click)="reset()">
          <mat-icon class="btn-icon">refresh</mat-icon>
          New Migration
        </button>
      </div>

      <div *ngIf="errorMessage" class="error-message" role="alert">{{ errorMessage }}</div>
    </div>
  `,
  styles: [`
    .migration-trigger {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #37474f;
    }
    .section-icon {
      color: #90a4ae;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .migration-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: #546e7a;
    }
    .select-container {
      position: relative;
    }
    .native-select, .native-input {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      color: #37474f;
      background: #fff;
      border: 1.5px solid #cfd8dc;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }
    .native-select {
      padding-right: 36px;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    .native-select:hover, .native-input:hover { border-color: #90a4ae; }
    .native-select:focus, .native-input:focus {
      border-color: #2d6a9f;
      box-shadow: 0 0 0 3px rgba(45, 106, 159, 0.12);
    }
    .select-arrow {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #78909c;
      pointer-events: none;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 20px;
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
      color: #fff;
      background: linear-gradient(135deg, #1e3a5f, #2d6a9f);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s, box-shadow 0.2s;
      align-self: flex-start;
    }
    .action-btn:hover:not(:disabled) {
      opacity: 0.9;
      box-shadow: 0 2px 8px rgba(30, 58, 95, 0.3);
    }
    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .action-btn.secondary {
      background: linear-gradient(135deg, #546e7a, #78909c);
    }
    .btn-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .migration-status {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .status-label {
      font-weight: 500;
      color: #546e7a;
      min-width: 50px;
    }
    .status-value { color: #37474f; }
    .mono { font-family: monospace; font-size: 13px; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-queued { background: #fff3e0; color: #e65100; }
    .badge-running { background: #e3f2fd; color: #1565c0; }
    .badge-completed { background: #e8f5e9; color: #2e7d32; }
    .badge-failed { background: #fce4ec; color: #c62828; }
    .badge-idle { background: #f5f5f5; color: #757575; }
    .error-message {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      background: #fce4ec;
      color: #c62828;
    }
    .ai-upgrade-options {
      margin-top: 4px;
    }
  `],
})
export class MigrationTriggerComponent implements OnDestroy {
  @Input() repositoryId: string | null = null;

  migrationType = '';
  parametersInput = '';
  loading = false;
  errorMessage = '';

  aiUpgradeMode: 'all' | 'specific' = 'all';
  aiDependenciesInput = '';

  migrationId: string | null = null;
  migrationStatus: 'idle' | 'queued' | 'running' | 'completed' | 'failed' = 'idle';
  migrationResult: string | null = null;
  migrationError: string | null = null;

  private pollSub: Subscription | null = null;

  constructor(private readonly migrationService: MigrationService) {}

  canTrigger(): boolean {
    return !!this.repositoryId && !!this.migrationType && !this.loading;
  }

  triggerMigration(): void {
    if (!this.canTrigger()) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    let params: Record<string, unknown> | undefined;

    if (this.migrationType === 'ai-upgrade') {
      if (this.aiUpgradeMode === 'all') {
        params = { upgradeAll: true };
      } else {
        const deps = this.aiDependenciesInput
          .split(',')
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
          .map((name) => ({ name }));
        params = { dependencies: deps };
      }
    } else {
      params = this.parseParameters(this.parametersInput);
    }

    this.migrationService
      .triggerMigration(this.repositoryId!, this.migrationType, params)
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.migrationId = response.migrationId;
          this.migrationStatus = (response.status as typeof this.migrationStatus) || 'queued';
          this.startPolling();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage =
            err?.error?.message || err?.message || 'Failed to trigger migration.';
        },
      });
  }

  reset(): void {
    this.stopPolling();
    this.migrationId = null;
    this.migrationStatus = 'idle';
    this.migrationResult = null;
    this.migrationError = null;
    this.migrationType = '';
    this.parametersInput = '';
    this.aiUpgradeMode = 'all';
    this.aiDependenciesInput = '';
    this.errorMessage = '';
  }

  onMigrationTypeChange(): void {
    this.aiUpgradeMode = 'all';
    this.aiDependenciesInput = '';
    this.parametersInput = '';
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  parseParameters(input: string): Record<string, string> | undefined {
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    const params: Record<string, string> = {};
    trimmed.split(',').forEach((pair) => {
      const [key, ...rest] = pair.split('=');
      if (key?.trim()) {
        params[key.trim()] = rest.join('=').trim();
      }
    });
    return Object.keys(params).length > 0 ? params : undefined;
  }

  private startPolling(): void {
    this.stopPolling();
    if (!this.migrationId) {
      return;
    }

    this.pollSub = timer(2000, 3000)
      .pipe(
        switchMap(() => this.migrationService.getMigrationStatus(this.migrationId!)),
      )
      .subscribe({
        next: (status: MigrationStatus) => {
          this.migrationStatus = status.status;
          this.migrationResult = status.result || null;
          this.migrationError = status.errorDetails || null;
          if (status.status === 'completed' || status.status === 'failed') {
            this.stopPolling();
          }
        },
        error: () => {
          this.stopPolling();
        },
      });
  }

  private stopPolling(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = null;
    }
  }
}
