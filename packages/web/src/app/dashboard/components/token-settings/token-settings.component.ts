import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RepositoryService } from '../../services/repository.service';

@Component({
  selector: 'app-token-settings',
  template: `
    <div class="token-settings">
      <div class="section-header">
        <mat-icon class="section-icon">vpn_key</mat-icon>
        <h3>Access Tokens</h3>
      </div>

      <div class="configured-providers" *ngIf="configuredProviders.length > 0">
        <div *ngFor="let provider of configuredProviders" class="provider-chip">
          <mat-icon class="chip-icon">check_circle</mat-icon>
          {{ providerLabel(provider) }}
        </div>
      </div>

      <form (ngSubmit)="onSave()" class="token-form">
        <div class="field-group">
          <label class="field-label" for="githubToken">GitHub Token</label>
          <input
            id="githubToken"
            type="password"
            class="native-input"
            [(ngModel)]="githubToken"
            name="githubToken"
            placeholder="Enter GitHub personal access token"
            autocomplete="off"
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="azureToken">Azure DevOps Token</label>
          <input
            id="azureToken"
            type="password"
            class="native-input"
            [(ngModel)]="azureToken"
            name="azureToken"
            placeholder="Enter Azure DevOps personal access token"
            autocomplete="off"
          />
        </div>

        <button class="action-btn" type="submit" [disabled]="saving || (!githubToken && !azureToken)">
          <mat-icon class="btn-icon">{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
          {{ saving ? 'Saving...' : 'Save Tokens' }}
        </button>
      </form>

      <div *ngIf="errorMessage" class="error-message" role="alert">{{ errorMessage }}</div>
    </div>
  `,
  styles: [`
    .token-settings {
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
    .configured-providers {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .provider-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      background: #e8f5e9;
      color: #2e7d32;
    }
    .chip-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .token-form {
      display: flex;
      flex-direction: column;
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
    .native-input {
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
    .native-input:hover { border-color: #90a4ae; }
    .native-input:focus {
      border-color: #2d6a9f;
      box-shadow: 0 0 0 3px rgba(45, 106, 159, 0.12);
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
    .btn-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .error-message {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      background: #fce4ec;
      color: #c62828;
    }
  `],
})
export class TokenSettingsComponent implements OnInit {
  githubToken = '';
  azureToken = '';
  saving = false;
  errorMessage = '';
  configuredProviders: string[] = [];

  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadConfiguredProviders();
  }

  providerLabel(provider: string): string {
    switch (provider) {
      case 'github': return 'GitHub';
      case 'azure_devops': return 'Azure DevOps';
      default: return provider;
    }
  }

  loadConfiguredProviders(): void {
    this.repositoryService.getTokens().subscribe({
      next: (result) => {
        this.configuredProviders = result?.providers ?? [];
      },
      error: () => {
        this.configuredProviders = [];
      },
    });
  }

  onSave(): void {
    this.errorMessage = '';
    this.saving = true;

    const saves: Array<{ provider: string; token: string }> = [];
    if (this.githubToken) {
      saves.push({ provider: 'github', token: this.githubToken });
    }
    if (this.azureToken) {
      saves.push({ provider: 'azure_devops', token: this.azureToken });
    }

    if (saves.length === 0) {
      this.saving = false;
      return;
    }

    let completed = 0;
    let failed = false;

    for (const save of saves) {
      this.repositoryService.updateTokens(save).subscribe({
        next: () => {
          completed++;
          if (completed === saves.length && !failed) {
            this.saving = false;
            this.snackBar.open('Tokens saved successfully', 'Close', { duration: 5000 });
            this.githubToken = '';
            this.azureToken = '';
            this.loadConfiguredProviders();
          }
        },
        error: () => {
          if (!failed) {
            failed = true;
            this.saving = false;
            this.errorMessage = 'Failed to save tokens. Please try again.';
          }
        },
      });
    }
  }
}
