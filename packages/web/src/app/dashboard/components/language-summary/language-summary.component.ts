import { Component, Input, OnChanges } from '@angular/core';
import { RepositoryLanguage } from '../../models/repository.models';

@Component({
  selector: 'app-language-summary',
  template: `
    <div class="language-summary">
      <div class="section-header">
        <mat-icon class="section-icon">code</mat-icon>
        <h3>Languages</h3>
      </div>
      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
      <div *ngIf="!loading && !hasLanguages" class="empty-state">
        <mat-icon>code_off</mat-icon>
        <p>No languages detected</p>
      </div>
      <ngx-charts-bar-vertical
        *ngIf="!loading && hasLanguages"
        [results]="chartData"
        [xAxisLabel]="'Language'"
        [yAxisLabel]="'Usage (%)'"
        [showXAxisLabel]="true"
        [showYAxisLabel]="true"
        [xAxis]="true"
        [yAxis]="true"
        [view]="[500, 300]"
        [scheme]="'cool'"
        [gradient]="true"
        [roundEdges]="true"
        aria-label="Language usage chart">
      </ngx-charts-bar-vertical>
    </div>
  `,
  styles: [`
    .language-summary { padding: 16px; }
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
      color: #4db6ac;
      font-size: 22px;
      width: 22px;
      height: 22px;
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
export class LanguageSummaryComponent implements OnChanges {
  @Input() languages: RepositoryLanguage[] | null = null;
  @Input() loading = false;

  chartData: { name: string; value: number }[] = [];
  hasLanguages = false;

  ngOnChanges(): void {
    this.updateChart();
  }

  private updateChart(): void {
    if (!this.languages || this.languages.length === 0) {
      this.chartData = [];
      this.hasLanguages = false;
      return;
    }

    this.hasLanguages = true;
    this.chartData = this.languages.map((lang) => ({
      name: lang.language,
      value: Math.round(lang.proportion * 100 * 100) / 100,
    }));
  }
}
