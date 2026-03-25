import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Repository } from '../../models/repository.models';
import { RepositoryService } from '../../services/repository.service';

const SOURCE_TYPE_ICONS: Record<string, string> = {
  local: 'folder',
  github: 'code',
  azure_devops: 'cloud',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  local: 'Local',
  github: 'GitHub',
  azure_devops: 'Azure',
};

@Component({
  selector: 'app-repository-selector',
  template: `
    <div class="selector-wrapper">
      <label class="selector-label" for="repoSelect">
        <mat-icon class="label-icon">folder_open</mat-icon>
        Select Repository
      </label>
      <div class="select-container">
        <select
          id="repoSelect"
          class="native-select"
          [disabled]="loading || repositories.length === 0 || !!errorMessage"
          [value]="selectedId || ''"
          (change)="onNativeChange($event)"
          aria-label="Select a repository"
        >
          <option value="" disabled selected>{{ getPlaceholder() }}</option>
          <option *ngFor="let repo of repositories" [value]="repo.id">
            {{ getSourceLabel(repo.sourceType) }} · {{ repo.name }}
          </option>
        </select>
        <mat-icon class="select-arrow">expand_more</mat-icon>
      </div>
      <span *ngIf="loading" class="hint loading-hint">Loading repositories…</span>
      <span *ngIf="!loading && repositories.length === 0 && !errorMessage" class="hint empty-hint">
        No repositories available
      </span>
      <span *ngIf="errorMessage" class="hint error-hint">{{ errorMessage }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .selector-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .selector-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #546e7a;
    }

    .label-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2d6a9f;
    }

    .select-container {
      position: relative;
    }

    .native-select {
      width: 100%;
      padding: 10px 36px 10px 12px;
      font-size: 14px;
      font-family: inherit;
      color: #37474f;
      background: #fff;
      border: 1.5px solid #cfd8dc;
      border-radius: 8px;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }

    .native-select:hover:not(:disabled) {
      border-color: #90a4ae;
    }

    .native-select:focus:not(:disabled) {
      border-color: #2d6a9f;
      box-shadow: 0 0 0 3px rgba(45, 106, 159, 0.12);
    }

    .native-select:disabled {
      background: #f5f5f5;
      color: #9e9e9e;
      cursor: not-allowed;
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

    .hint {
      font-size: 12px;
      margin-top: 2px;
    }

    .loading-hint {
      color: #78909c;
      font-style: italic;
    }

    .empty-hint {
      color: #90a4ae;
    }

    .error-hint {
      color: #e53935;
    }
  `],
})
export class RepositorySelectorComponent implements OnInit, OnChanges {
  @Input() autoSelectId: string | null = null;
  @Output() selectionChange = new EventEmitter<string>();

  repositories: Repository[] = [];
  selectedId: string | null = null;
  loading = false;
  errorMessage: string | null = null;

  constructor(private readonly repositoryService: RepositoryService) {}

  ngOnInit(): void {
    this.fetchRepositories();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['autoSelectId'] && this.autoSelectId !== null) {
      this.fetchRepositories(this.autoSelectId);
    }
  }

  getSourceIcon(sourceType: string): string {
    return SOURCE_TYPE_ICONS[sourceType] || 'help_outline';
  }

  getSourceLabel(sourceType: string): string {
    return SOURCE_TYPE_LABELS[sourceType] || sourceType;
  }

  getPlaceholder(): string {
    if (this.loading) {
      return 'Loading…';
    }
    if (this.errorMessage) {
      return 'Error loading repositories';
    }
    if (this.repositories.length === 0) {
      return 'No repositories available';
    }
    return 'Choose a repository…';
  }

  onSelectionChange(repositoryId: string): void {
    this.selectionChange.emit(repositoryId);
  }

  onNativeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedId = select.value;
    this.selectionChange.emit(select.value);
  }

  private fetchRepositories(autoSelectId?: string): void {
    this.loading = true;
    this.errorMessage = null;

    this.repositoryService.listRepositories().subscribe({
      next: (repos) => {
        this.repositories = repos;
        this.loading = false;

        if (autoSelectId) {
          this.selectedId = autoSelectId;
          this.selectionChange.emit(autoSelectId);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message || err?.message || 'Failed to load repositories.';
      },
    });
  }
}
