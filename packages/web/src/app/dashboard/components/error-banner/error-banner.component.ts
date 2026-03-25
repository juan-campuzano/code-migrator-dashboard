import { Component, Input } from '@angular/core';

export interface ScanError {
  file: string;
  message: string;
}

@Component({
  selector: 'app-error-banner',
  template: `
    <div class="error-banner" *ngIf="hasErrors" role="alert">
      <h4 class="error-banner-title">Scan Errors</h4>
      <ul class="error-list">
        <li *ngFor="let error of errors" class="error-item">
          <span class="error-file">{{ error.file }}</span>:
          <span class="error-message">{{ error.message }}</span>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .error-banner {
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      padding: 16px;
      border-radius: 12px;
    }
    .error-banner-title {
      color: var(--mat-sys-error);
      margin: 0 0 8px 0;
    }
    .error-list {
      margin: 0;
      padding-left: 20px;
    }
    .error-item {
      margin-bottom: 4px;
    }
    .error-file {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
  `],
})
export class ErrorBannerComponent {
  @Input() errors: ScanError[] | null = null;

  get hasErrors(): boolean {
    return !!this.errors && this.errors.length > 0;
  }
}
