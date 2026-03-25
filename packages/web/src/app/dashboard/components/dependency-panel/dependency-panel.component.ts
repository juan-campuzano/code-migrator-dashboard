import { Component, Input, OnChanges, ViewChild } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';
import { RepositoryDependency } from '../../models/repository.models';

export interface EcosystemGroup {
  ecosystem: string;
  dependencies: RepositoryDependency[];
}

@Component({
  selector: 'app-dependency-panel',
  template: `
    <mat-card-content>
      <div class="section-header">
        <mat-icon class="section-icon">inventory_2</mat-icon>
        <h3>Dependencies</h3>
      </div>
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
      <div *ngIf="!loading && !hasDependencies" class="empty-state">
        <mat-icon>inventory_2</mat-icon>
        <p>No dependencies found</p>
      </div>
      <div *ngIf="!loading && hasDependencies">
        <div class="panel-actions">
          <button mat-stroked-button (click)="expandAll()">Expand All</button>
          <button mat-stroked-button (click)="collapseAll()">Collapse All</button>
        </div>
        <mat-accordion multi>
          <mat-expansion-panel *ngFor="let group of ecosystemGroups">
            <mat-expansion-panel-header>
              <mat-panel-title>{{ group.ecosystem }}</mat-panel-title>
              <mat-panel-description>{{ group.dependencies.length }} dependencies</mat-panel-description>
            </mat-expansion-panel-header>
            <mat-table [dataSource]="group.dependencies">
              <ng-container matColumnDef="name">
                <mat-header-cell *matHeaderCellDef>Name</mat-header-cell>
                <mat-cell *matCellDef="let dep">{{ dep.name }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="version">
                <mat-header-cell *matHeaderCellDef>Version</mat-header-cell>
                <mat-cell *matCellDef="let dep">
                  <span class="version-badge">{{ dep.versionConstraint || 'N/A' }}</span>
                </mat-cell>
              </ng-container>
              <ng-container matColumnDef="type">
                <mat-header-cell *matHeaderCellDef>Type</mat-header-cell>
                <mat-cell *matCellDef="let dep">
                  <span class="type-badge" [class.dev-badge]="dep.dependencyType === 'development'">
                    {{ dep.dependencyType || 'N/A' }}
                  </span>
                </mat-cell>
              </ng-container>
              <mat-header-row *matHeaderRowDef="depColumns"></mat-header-row>
              <mat-row *matRowDef="let row; columns: depColumns;"></mat-row>
            </mat-table>
          </mat-expansion-panel>
        </mat-accordion>
      </div>
    </mat-card-content>
  `,
  styles: [`
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
      color: #e8734a;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .panel-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    mat-table { width: 100%; }
    mat-header-row { background-color: #f5f7fa; }
    mat-row:hover { background-color: #f5f7fa; }
    .version-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: #fff3e0;
      color: #e65100;
    }
    .type-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: #e8f5e9;
      color: #2e7d32;
    }
    .dev-badge {
      background: #fce4ec;
      color: #c62828;
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
export class DependencyPanelComponent implements OnChanges {
  @Input() dependencies: RepositoryDependency[] | null = null;
  @Input() loading = false;

  @ViewChild(MatAccordion) accordion!: MatAccordion;

  ecosystemGroups: EcosystemGroup[] = [];
  hasDependencies = false;
  depColumns = ['name', 'version', 'type'];

  ngOnChanges(): void {
    this.updateGroups();
  }

  expandAll(): void {
    this.accordion?.openAll();
  }

  collapseAll(): void {
    this.accordion?.closeAll();
  }

  private updateGroups(): void {
    if (!this.dependencies || this.dependencies.length === 0) {
      this.ecosystemGroups = [];
      this.hasDependencies = false;
      return;
    }

    this.hasDependencies = true;

    const grouped = new Map<string, RepositoryDependency[]>();
    for (const dep of this.dependencies) {
      const list = grouped.get(dep.ecosystem) || [];
      list.push(dep);
      grouped.set(dep.ecosystem, list);
    }

    this.ecosystemGroups = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ecosystem, dependencies]) => ({ ecosystem, dependencies }));
  }
}
