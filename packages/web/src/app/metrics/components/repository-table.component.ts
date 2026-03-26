import { Component, Input, OnChanges, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { RepositoryGrade, RepositorySummary } from '../models/metrics.models';

@Component({
  selector: 'app-repository-table',
  template: `
    <div class="table-wrap">
      <div class="table-header">
        <span class="table-title">Repositories</span>
        <span class="table-count">{{ repositories.length }}</span>
      </div>

      <div class="table-scroll">
        <table mat-table [dataSource]="dataSource" matSort
               (matSortChange)="onSortChange($event)"
               class="repo-table">

          <!-- Name -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
            <td mat-cell *matCellDef="let row" class="cell-name">{{ row.name }}</td>
          </ng-container>

          <!-- Source Type -->
          <ng-container matColumnDef="sourceType">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Source</th>
            <td mat-cell *matCellDef="let row" class="cell-source">
              <span class="source-badge">{{ formatSource(row.sourceType) }}</span>
            </td>
          </ng-container>

          <!-- Grade -->
          <ng-container matColumnDef="freshnessGrade">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Grade</th>
            <td mat-cell *matCellDef="let row" class="cell-grade">
              <span *ngIf="row.freshnessStatus === 'pending'" class="grade-pending">Pending</span>
              <span *ngIf="row.freshnessStatus !== 'pending'"
                    class="grade-badge"
                    [style.background]="gradeColor(row.freshnessGrade)"
                    [style.color]="'#fff'">
                {{ row.freshnessGrade }}
              </span>
            </td>
          </ng-container>

          <!-- Score -->
          <ng-container matColumnDef="freshnessScore">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Score</th>
            <td mat-cell *matCellDef="let row" class="cell-score">
              <span *ngIf="row.freshnessStatus === 'pending'" class="score-pending">Pending</span>
              <span *ngIf="row.freshnessStatus !== 'pending'" class="score-value">
                {{ row.freshnessScore | number:'1.1-1' }}
              </span>
            </td>
          </ng-container>

          <!-- Total Dependencies -->
          <ng-container matColumnDef="totalDependencies">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Deps</th>
            <td mat-cell *matCellDef="let row">{{ row.totalDependencies }}</td>
          </ng-container>

          <!-- Primary Language -->
          <ng-container matColumnDef="primaryLanguage">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Language</th>
            <td mat-cell *matCellDef="let row" class="cell-lang">
              {{ row.primaryLanguage || '—' }}
            </td>
          </ng-container>

          <!-- Last Ingestion -->
          <ng-container matColumnDef="lastIngestionDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Last Ingestion</th>
            <td mat-cell *matCellDef="let row" class="cell-date">
              {{ row.lastIngestionDate ? (row.lastIngestionDate | date:'mediumDate') : '—' }}
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row
              *matRowDef="let row; columns: displayedColumns;"
              class="repo-row"
              (click)="onRowClick(row)">
          </tr>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .table-wrap {
      background: var(--ms-card-bg, #ffffff);
      border-radius: var(--ms-radius, 14px);
      box-shadow: var(--ms-card-shadow, 0 2px 16px rgba(30, 60, 52, 0.07));
      overflow: hidden;
    }

    .table-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 24px 14px;
    }

    .table-title {
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 18px;
      color: var(--ms-text, #2c2c2c);
      letter-spacing: 0.2px;
    }

    .table-count {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 11px;
      font-weight: 600;
      background: var(--ms-accent, #d4a24e);
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      letter-spacing: 0.3px;
    }

    .table-scroll {
      overflow-x: auto;
    }

    /* ── Table ── */
    .repo-table {
      width: 100%;
      border-collapse: collapse;
    }

    :host ::ng-deep .mat-mdc-header-cell {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--ms-text-muted, #7a7a72);
      border-bottom: 2px solid rgba(0, 0, 0, 0.06);
      padding: 10px 16px;
      white-space: nowrap;
    }

    :host ::ng-deep .mat-mdc-cell {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 13.5px;
      color: var(--ms-text, #2c2c2c);
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    }

    /* ── Row hover ── */
    .repo-row {
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .repo-row:hover {
      background: rgba(212, 162, 78, 0.06);
    }

    /* ── Cell: Name ── */
    .cell-name {
      font-weight: 500;
      letter-spacing: 0.1px;
    }

    /* ── Cell: Source badge ── */
    .source-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.05);
      color: var(--ms-text-muted, #7a7a72);
    }

    /* ── Cell: Grade badge ── */
    .grade-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 14px;
      font-weight: 400;
      line-height: 1;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }

    .grade-pending {
      font-size: 12px;
      font-style: italic;
      color: var(--ms-text-muted, #7a7a72);
      letter-spacing: 0.2px;
    }

    /* ── Cell: Score ── */
    .score-value {
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }

    .score-pending {
      font-size: 12px;
      font-style: italic;
      color: var(--ms-text-muted, #7a7a72);
      letter-spacing: 0.2px;
    }

    /* ── Cell: Language ── */
    .cell-lang {
      letter-spacing: 0.1px;
    }

    /* ── Cell: Date ── */
    .cell-date {
      white-space: nowrap;
      color: var(--ms-text-muted, #7a7a72);
      font-size: 12.5px;
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .table-header {
        padding: 16px 16px 10px;
      }

      :host ::ng-deep .mat-mdc-header-cell,
      :host ::ng-deep .mat-mdc-cell {
        padding: 10px 10px;
      }
    }
  `],
})
export class RepositoryTableComponent implements OnChanges, AfterViewInit {
  @Input() repositories: RepositorySummary[] = [];

  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'name',
    'sourceType',
    'freshnessGrade',
    'freshnessScore',
    'totalDependencies',
    'primaryLanguage',
    'lastIngestionDate',
  ];

  dataSource = new MatTableDataSource<RepositorySummary>([]);

  private static readonly GRADE_COLORS: Record<RepositoryGrade, string> = {
    A: '#4caf50',
    B: '#2196f3',
    C: '#ff9800',
    D: '#f57c00',
    E: '#f44336',
  };

  constructor(private readonly router: Router) {}

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (row: RepositorySummary, col: string): string | number => {
      switch (col) {
        case 'freshnessScore':
          // null/pending → -1 so they sort to top in ascending order
          return row.freshnessScore ?? -1;
        case 'freshnessGrade':
          return row.freshnessGrade ?? '';
        case 'lastIngestionDate':
          return row.lastIngestionDate ?? '';
        case 'primaryLanguage':
          return row.primaryLanguage ?? '';
        default:
          return (row as any)[col] ?? '';
      }
    };

    // Apply default sort: ascending by freshnessScore
    if (this.sort) {
      this.sort.active = 'freshnessScore';
      this.sort.direction = 'asc';
      this.sort.sortChange.emit({ active: 'freshnessScore', direction: 'asc' });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['repositories']) {
      this.applyData();
    }
  }

  onSortChange(_sort: Sort): void {
    // MatSort handles it via dataSource.sort binding
  }

  onRowClick(row: RepositorySummary): void {
    this.router.navigate(['/'], { queryParams: { repo: row.id } });
  }

  gradeColor(grade: RepositoryGrade | null): string {
    if (!grade) {
      return '#7a7a72';
    }
    return RepositoryTableComponent.GRADE_COLORS[grade] ?? '#7a7a72';
  }

  formatSource(sourceType: string): string {
    switch (sourceType) {
      case 'github': return 'GitHub';
      case 'azure_devops': return 'Azure';
      case 'local': return 'Local';
      default: return sourceType;
    }
  }

  private applyData(): void {
    // Pre-sort: pending (null scores) first, then ascending by score
    const sorted = [...this.repositories].sort((a, b) => {
      const scoreA = a.freshnessScore;
      const scoreB = b.freshnessScore;
      if (scoreA === null && scoreB === null) return 0;
      if (scoreA === null) return -1;
      if (scoreB === null) return 1;
      return scoreA - scoreB;
    });
    this.dataSource.data = sorted;
  }
}
