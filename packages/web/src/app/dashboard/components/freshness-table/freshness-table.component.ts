import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { DependencyFreshnessScore } from '../../models/repository.models';

@Component({
  selector: 'app-freshness-table',
  template: `
    <div class="table-card">
      <div class="card-header" (click)="toggleCollapsed()">
        <div class="header-left">
          <mat-icon class="section-icon">table_chart</mat-icon>
          <h3>Dependency Scores</h3>
          <span class="dep-count" *ngIf="dataSource.data.length">
            {{ dataSource.filteredData.length }}
            <span *ngIf="selectedEcosystem">of {{ dataSource.data.length }}</span>
          </span>
        </div>
        <div class="header-right">
          <mat-form-field
            class="ecosystem-filter"
            appearance="outline"
            *ngIf="ecosystems.length > 1 && !collapsed"
            (click)="$event.stopPropagation()">
            <mat-label>Ecosystem</mat-label>
            <mat-select
              [(value)]="selectedEcosystem"
              (selectionChange)="applyFilter()"
              panelClass="ecosystem-dropdown">
              <mat-option [value]="''">All ecosystems</mat-option>
              <mat-option *ngFor="let eco of ecosystems" [value]="eco">
                {{ eco }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <mat-icon class="collapse-icon" [class.collapsed]="collapsed">expand_more</mat-icon>
        </div>
      </div>

      <div class="collapsible-body" [class.collapsed]="collapsed">
        <mat-progress-bar
          mode="indeterminate"
          color="accent"
          *ngIf="loading"
          class="table-loader">
        </mat-progress-bar>

        <div *ngIf="!loading && dataSource.data.length === 0" class="empty-state">
          <mat-icon>playlist_remove</mat-icon>
          <p>No dependency scores available</p>
        </div>

        <div class="table-wrap" *ngIf="!loading && dataSource.data.length > 0">
        <table mat-table [dataSource]="dataSource" matSort class="score-table">

          <ng-container matColumnDef="dependencyName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
            <td mat-cell *matCellDef="let row">
              <span class="dep-name">{{ row.dependencyName }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="ecosystem">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Ecosystem</th>
            <td mat-cell *matCellDef="let row">
              <span class="eco-badge">{{ row.ecosystem }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="resolvedVersion">
            <th mat-header-cell *matHeaderCellDef>Current</th>
            <td mat-cell *matCellDef="let row">
              <code class="version-cell">{{ row.resolvedVersion || '—' }}</code>
            </td>
          </ng-container>

          <ng-container matColumnDef="latestVersion">
            <th mat-header-cell *matHeaderCellDef>Latest</th>
            <td mat-cell *matCellDef="let row">
              <code class="version-cell">{{ row.latestVersion || '—' }}</code>
            </td>
          </ng-container>

          <ng-container matColumnDef="score">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Score</th>
            <td mat-cell *matCellDef="let row">
              <span
                class="score-pill"
                [ngClass]="getScoreClass(row.score)"
                *ngIf="row.score !== null && row.score !== undefined">
                {{ row.score }}
              </span>
              <span class="score-na" *ngIf="row.score === null || row.score === undefined">
                N/A
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="dependencyType">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let row">
              <span class="type-tag" [class.type-dev]="row.dependencyType === 'development'">
                {{ row.dependencyType === 'development' ? 'dev' : 'prod' }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="dep-row"></tr>
        </table>
      </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --ga: #0d9f6e; --ga-bg: rgba(13,159,110,.08);
      --gb: #5fa843; --gb-bg: rgba(95,168,67,.08);
      --gc: #c5a332; --gc-bg: rgba(197,163,50,.08);
      --gd: #d4712a; --gd-bg: rgba(212,113,42,.08);
      --ge: #c93b3b; --ge-bg: rgba(201,59,59,.08);
      --tp: #1e293b; --ts: #64748b; --tm: #94a3b8;
      --sf: #f8fafc; --bd: #e2e8f0;
      --mono: 'JetBrains Mono','Fira Code','Menlo',monospace;
    }
    .table-card { padding: 20px 24px; border-radius: 10px; background: var(--sf); border: 1px solid var(--bd); }
    .card-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; cursor: pointer; user-select: none; }
    .card-header:not(:last-child) { margin-bottom: 16px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .collapse-icon { color: var(--tm); font-size: 22px; width: 22px; height: 22px; transition: transform .25s ease; }
    .collapse-icon.collapsed { transform: rotate(-90deg); }
    .collapsible-body { overflow: hidden; max-height: 2000px; opacity: 1; transition: max-height .35s ease, opacity .25s ease; }
    .collapsible-body.collapsed { max-height: 0; opacity: 0; }
    .header-left { display: flex; align-items: center; gap: 8px; }
    .header-left h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--tp); }
    .section-icon { color: #6366f1; font-size: 20px; width: 20px; height: 20px; }
    .dep-count { font-size: 12px; font-weight: 600; color: var(--tm); background: rgba(99,102,241,.08); padding: 2px 8px; border-radius: 10px; font-family: var(--mono); }
    .ecosystem-filter { width: 180px; font-size: 13px; }
    :host ::ng-deep .ecosystem-filter .mat-mdc-text-field-wrapper { height: 40px; }
    :host ::ng-deep .ecosystem-filter .mat-mdc-form-field-infix { padding-top: 8px; padding-bottom: 8px; min-height: unset; }
    .table-loader { border-radius: 4px; margin-bottom: 12px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 36px 16px; color: var(--tm); }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 10px; opacity: .6; }
    .empty-state p { margin: 0; font-size: 13px; font-weight: 500; }
    .table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid var(--bd); background: #fff; }
    .score-table { width: 100%; }
    :host ::ng-deep .score-table .mat-mdc-header-row { background: linear-gradient(180deg,#f1f5f9,#e8ecf1); height: 44px; }
    :host ::ng-deep .score-table .mat-mdc-header-cell { font-size: 11px; font-weight: 700; color: var(--ts); text-transform: uppercase; letter-spacing: .06em; border-bottom: 2px solid var(--bd); padding: 0 16px; }
    :host ::ng-deep .score-table .mat-mdc-row { height: 48px; transition: background .15s ease; }
    :host ::ng-deep .score-table .mat-mdc-row:hover { background: rgba(99,102,241,.03); }
    :host ::ng-deep .score-table .mat-mdc-cell { font-size: 13px; color: var(--tp); border-bottom: 1px solid #f1f5f9; padding: 0 16px; }
    .dep-name { font-weight: 600; font-size: 13px; }
    .eco-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; background: rgba(99,102,241,.07); color: #4f46e5; text-transform: lowercase; }
    .version-cell { font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--ts); background: rgba(0,0,0,.03); padding: 2px 8px; border-radius: 4px; }
    .score-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 38px; padding: 3px 10px; border-radius: 12px; font-family: var(--mono); font-size: 12px; font-weight: 700; }
    .score-a { background: var(--ga-bg); color: var(--ga); border: 1px solid rgba(13,159,110,.2); }
    .score-b { background: var(--gb-bg); color: var(--gb); border: 1px solid rgba(95,168,67,.2); }
    .score-c { background: var(--gc-bg); color: var(--gc); border: 1px solid rgba(197,163,50,.2); }
    .score-d { background: var(--gd-bg); color: var(--gd); border: 1px solid rgba(212,113,42,.2); }
    .score-e { background: var(--ge-bg); color: var(--ge); border: 1px solid rgba(201,59,59,.2); }
    .score-na { font-size: 12px; font-weight: 500; color: var(--tm); font-style: italic; }
    .type-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #ecfdf5; color: #059669; }
    .type-dev { background: #fef3f2; color: #dc2626; }
  `],
})
export class FreshnessTableComponent implements OnChanges, AfterViewInit {
  @Input() dependencies: DependencyFreshnessScore[] | null = null;
  @Input() loading = false;

  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'dependencyName',
    'ecosystem',
    'resolvedVersion',
    'latestVersion',
    'score',
    'dependencyType',
  ];

  dataSource = new MatTableDataSource<DependencyFreshnessScore>([]);
  ecosystems: string[] = [];
  selectedEcosystem = '';
  collapsed = false;

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dependencies']) {
      const deps = this.dependencies ?? [];
      this.dataSource.data = deps;
      this.ecosystems = this.extractEcosystems(deps);

      // Reset filter when data changes
      this.selectedEcosystem = '';
      this.dataSource.filterPredicate = (data, filter) =>
        !filter || data.ecosystem === filter;
      this.dataSource.filter = '';

      // Re-attach sort if already available
      if (this.sort) {
        this.dataSource.sort = this.sort;
      }
    }
  }

  applyFilter(): void {
    this.dataSource.filter = this.selectedEcosystem;
  }

  getScoreClass(score: number | null): string {
    if (score === null || score === undefined) return '';
    if (score >= 90) return 'score-a';
    if (score >= 70) return 'score-b';
    if (score >= 50) return 'score-c';
    if (score >= 30) return 'score-d';
    return 'score-e';
  }

  private extractEcosystems(deps: DependencyFreshnessScore[]): string[] {
    const unique = new Set(deps.map((d) => d.ecosystem));
    return Array.from(unique).sort();
  }
}
