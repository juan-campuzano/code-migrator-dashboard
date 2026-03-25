import { Component, EventEmitter, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RepositoryService } from '../../services/repository.service';

@Component({
  selector: 'app-ingestion-form',
  template: `
    <form (ngSubmit)="onSubmit()" class="ingestion-form">
      <div class="field-group">
        <label class="field-label" for="sourceInput">Repository path or URL</label>
        <input
          id="sourceInput"
          type="text"
          class="native-input"
          [(ngModel)]="sourceInput"
          name="sourceInput"
          placeholder="e.g. /path/to/repo or https://github.com/owner/repo"
          [disabled]="loading"
          required
        />
      </div>
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
      <button class="action-btn" type="submit" [disabled]="loading || !sourceInput.trim()">
        <mat-icon class="btn-icon">{{ loading ? 'hourglass_empty' : 'cloud_upload' }}</mat-icon>
        {{ loading ? 'Ingesting...' : 'Ingest' }}
      </button>
      <div *ngIf="errorMessage" class="error-container" role="alert">
        {{ errorMessage }}
      </div>
    </form>
  `,
  styles: [`
    .ingestion-form {
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
    .native-input:hover:not(:disabled) { border-color: #90a4ae; }
    .native-input:focus:not(:disabled) {
      border-color: #2d6a9f;
      box-shadow: 0 0 0 3px rgba(45, 106, 159, 0.12);
    }
    .native-input:disabled {
      background: #f5f5f5;
      color: #9e9e9e;
      cursor: not-allowed;
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
      background: linear-gradient(135deg, #e8734a, #d4593a);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s, box-shadow 0.2s;
      align-self: flex-start;
    }
    .action-btn:hover:not(:disabled) {
      opacity: 0.9;
      box-shadow: 0 2px 8px rgba(232, 115, 74, 0.3);
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
    .error-container {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      background: #fce4ec;
      color: #c62828;
    }
  `],
})
export class IngestionFormComponent {
  @Output() ingestionTriggered = new EventEmitter<string>();

  sourceInput = '';
  loading = false;
  errorMessage = '';

  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly snackBar: MatSnackBar,
  ) {}

  classifySource(input: string): { type: string; path?: string; url?: string } {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      if (url.hostname === 'github.com') {
        return { type: 'github', url: trimmed };
      }
      if (url.hostname === 'dev.azure.com') {
        return { type: 'azure_devops', url: trimmed };
      }
    } catch {
      // Not a valid URL, treat as local path
    }
    return { type: 'local', path: trimmed };
  }

  onSubmit(): void {
    const trimmed = this.sourceInput.trim();
    if (!trimmed) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const source = this.classifySource(trimmed);
    this.repositoryService.triggerIngestion(source).subscribe({
      next: (response) => {
        this.loading = false;
        this.ingestionTriggered.emit(response.ingestionId);
        this.snackBar.open('Ingestion completed successfully', 'Close', { duration: 5000 });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || err?.message || 'Ingestion request failed.';
      },
    });
  }
}
