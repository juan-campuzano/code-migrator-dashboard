import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { IngestionRecord } from '../../models/repository.models';
import { RepositoryService } from '../../services/repository.service';

@Component({
  selector: 'app-ingestion-status',
  template: `
    <div class="ingestion-status" *ngIf="ingestionId">
      <div class="section-header">
        <mat-icon class="section-icon">sync</mat-icon>
        <h3>Ingestion Status</h3>
      </div>

      <div class="status-row">
        <span class="status-label">Status:</span>
        <span class="status-badge" [attr.data-status]="currentStatus" [class]="'badge-' + currentStatus">
          {{ currentStatus }}
        </span>
        <span *ngIf="currentStatus === 'in_progress'" class="spinner" role="status" aria-label="Ingestion in progress">⏳</span>
      </div>

      <div *ngIf="lastCompletedAt" class="status-row">
        <span class="status-label">Completed:</span>
        <span class="status-value">{{ lastCompletedAt }}</span>
      </div>

      <div *ngIf="errorMessage" class="error-message" role="alert">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [`
    .ingestion-status {
      display: flex;
      flex-direction: column;
      gap: 10px;
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
      color: #2d6a9f;
      font-size: 22px;
      width: 22px;
      height: 22px;
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
    }
    .status-value { color: #37474f; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-pending { background: #f5f5f5; color: #757575; }
    .badge-in_progress { background: #e3f2fd; color: #1565c0; }
    .badge-completed { background: #e8f5e9; color: #2e7d32; }
    .badge-failed { background: #fce4ec; color: #c62828; }
    .error-message {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      background: #fce4ec;
      color: #c62828;
    }
  `],
})
export class IngestionStatusComponent implements OnInit, OnDestroy {
  @Input() ingestionId: string | null = null;
  @Output() ingestionCompleted = new EventEmitter<IngestionRecord>();

  currentStatus: string = '';
  lastCompletedAt: string | null = null;
  errorMessage: string = '';

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private previousRecord: IngestionRecord | null = null;
  private completedEmitted = false;

  constructor(private readonly repositoryService: RepositoryService) {}

  ngOnInit(): void {
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  ngOnChanges(): void {
    this.stopPolling();
    if (this.ingestionId) {
      this.errorMessage = '';
      this.currentStatus = '';
      this.completedEmitted = false;
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (!this.ingestionId) {
      return;
    }
    this.pollTimer = setInterval(() => this.fetchStatus(), 2000);
    this.fetchStatus();
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private fetchStatus(): void {
    if (!this.ingestionId) {
      return;
    }

    this.repositoryService.getIngestionStatus(this.ingestionId).subscribe({
      next: (record) => {
        this.previousRecord = record;
        this.currentStatus = record.status;
        this.errorMessage = '';

        if (record.status === 'completed') {
          this.lastCompletedAt = record.completedAt ?? null;
          this.stopPolling();
          if (!this.completedEmitted) {
            this.completedEmitted = true;
            this.ingestionCompleted.emit(record);
          }
        } else if (record.status === 'failed') {
          this.errorMessage = record.errorDetails ?? 'Ingestion failed.';
          this.stopPolling();
        }
      },
      error: () => {
        // Retain previous data on fetch error
        if (this.previousRecord) {
          this.currentStatus = this.previousRecord.status;
        }
        this.errorMessage = 'Failed to fetch ingestion status.';
      },
    });
  }
}
