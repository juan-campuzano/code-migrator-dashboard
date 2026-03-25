import { Component, Input } from '@angular/core';
import { RepositoryFramework } from '../../models/repository.models';

@Component({
  selector: 'app-framework-list',
  template: `
    <div class="framework-list">
      <div class="section-header">
        <mat-icon class="section-icon">layers</mat-icon>
        <h3>Frameworks</h3>
      </div>
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
      <div *ngIf="!loading && !hasFrameworks" class="empty-state">
        <mat-icon>layers_clear</mat-icon>
        <p>No frameworks detected</p>
      </div>
      <mat-table [dataSource]="frameworks!" *ngIf="!loading && hasFrameworks" class="framework-table">
        <ng-container matColumnDef="name">
          <mat-header-cell *matHeaderCellDef>Framework Name</mat-header-cell>
          <mat-cell *matCellDef="let fw">{{ fw.name }}</mat-cell>
        </ng-container>
        <ng-container matColumnDef="version">
          <mat-header-cell *matHeaderCellDef>Version</mat-header-cell>
          <mat-cell *matCellDef="let fw">
            <span class="version-badge">{{ fw.version || 'N/A' }}</span>
          </mat-cell>
        </ng-container>
        <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
        <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
      </mat-table>
    </div>
  `,
  styles: [`
    .framework-list { padding: 16px; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .section-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #37474f;
    }
    .section-icon {
      color: #7986cb;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .framework-table { width: 100%; }
    mat-header-row { background-color: #f5f7fa; }
    mat-row:hover { background-color: #f5f7fa; }
    .version-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: #e8eaf6;
      color: #3f51b5;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      color: #90a4ae;
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
  `],
})
export class FrameworkListComponent {
  @Input() frameworks: RepositoryFramework[] | null = null;
  @Input() loading = false;

  displayedColumns = ['name', 'version'];

  get hasFrameworks(): boolean {
    return !!this.frameworks && this.frameworks.length > 0;
  }
}
