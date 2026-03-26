import { Component, Input, OnChanges } from '@angular/core';
import { LanguageDistributionEntry } from '../models/metrics.models';

@Component({
  selector: 'app-language-chart',
  template: `
    <!-- Empty State -->
    <div class="chart-card" *ngIf="!hasData">
      <div class="card-header">
        <mat-icon class="header-icon">translate</mat-icon>
        <h3 class="header-title">Language Distribution</h3>
      </div>
      <div class="empty-state">
        <mat-icon class="empty-icon">code_off</mat-icon>
        <p class="empty-text">No language data available</p>
      </div>
    </div>

    <!-- Chart -->
    <div class="chart-card" *ngIf="hasData">
      <div class="card-header">
        <mat-icon class="header-icon">translate</mat-icon>
        <h3 class="header-title">Language Distribution</h3>
        <span class="header-count">{{ chartData.length }} languages</span>
      </div>

      <div class="chart-wrap">
        <ngx-charts-bar-horizontal
          [results]="chartData"
          [xAxisLabel]="'Percentage'"
          [yAxisLabel]="'Language'"
          [showXAxisLabel]="false"
          [showYAxisLabel]="false"
          [xAxis]="true"
          [yAxis]="true"
          [view]="[chartWidth, chartHeight]"
          [scheme]="colorScheme"
          [gradient]="true"
          [roundEdges]="true"
          [showDataLabel]="true"
          [dataLabelFormatting]="formatLabel"
          [xScaleMax]="100"
          [noBarWhenZero]="true"
          aria-label="Language distribution chart">
        </ngx-charts-bar-horizontal>
      </div>

      <!-- Accent bar -->
      <div class="accent-bar"></div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .chart-card {
      background: var(--ms-card-bg, #ffffff);
      border-radius: var(--ms-radius, 14px);
      box-shadow: var(--ms-card-shadow, 0 2px 16px rgba(30, 60, 52, 0.07));
      overflow: hidden;
      position: relative;
    }

    /* ── Header ── */
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 28px 0;
    }

    .header-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--ms-accent, #d4a24e);
    }

    .header-title {
      margin: 0;
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 17px;
      font-weight: 400;
      color: var(--ms-text, #2c2c2c);
      letter-spacing: 0.2px;
    }

    .header-count {
      margin-left: auto;
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 12px;
      color: var(--ms-text-muted, #7a7a72);
      letter-spacing: 0.3px;
      background: rgba(212, 162, 78, 0.1);
      padding: 3px 10px;
      border-radius: 20px;
    }

    /* ── Chart area ── */
    .chart-wrap {
      padding: 16px 20px 20px;
      display: flex;
      justify-content: center;
    }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 10px;
    }

    .empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: var(--ms-text-muted, #7a7a72);
      opacity: 0.5;
    }

    .empty-text {
      margin: 0;
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 14px;
      color: var(--ms-text-muted, #7a7a72);
      letter-spacing: 0.2px;
    }

    /* ── Accent bar ── */
    .accent-bar {
      height: 3px;
      background: linear-gradient(90deg, #2e7d68, var(--ms-accent, #d4a24e));
      opacity: 0.6;
    }

    /* ── ngx-charts overrides ── */
    :host ::ng-deep .ngx-charts {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif) !important;
    }

    :host ::ng-deep .ngx-charts .tick text,
    :host ::ng-deep .ngx-charts .y.axis text {
      fill: var(--ms-text-muted, #7a7a72) !important;
      font-size: 12px !important;
      font-family: var(--ms-font-body, 'DM Sans', sans-serif) !important;
    }

    :host ::ng-deep .ngx-charts .gridline-path {
      stroke: rgba(0, 0, 0, 0.06) !important;
    }

    :host ::ng-deep .textDataLabel {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif) !important;
      font-size: 11px !important;
      fill: var(--ms-text, #2c2c2c) !important;
      font-weight: 500 !important;
    }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .card-header {
        padding: 16px 16px 0;
      }

      .chart-wrap {
        padding: 12px 8px 16px;
      }
    }
  `],
})
export class LanguageChartComponent implements OnChanges {
  @Input() languageDistribution: LanguageDistributionEntry[] = [];

  chartData: { name: string; value: number }[] = [];
  hasData = false;

  colorScheme: any = {
    domain: [
      '#2e7d68', '#d4a24e', '#4db6ac', '#c17d3a',
      '#1a3c34', '#e8c77b', '#5f9ea0', '#8b6914',
      '#3a9688', '#b8860b', '#20695c', '#daa520',
    ],
  };

  chartWidth = 700;
  chartHeight = 200;

  formatLabel = (value: number): string => `${value.toFixed(1)}%`;

  ngOnChanges(): void {
    this.updateChart();
  }

  private updateChart(): void {
    if (!this.languageDistribution || this.languageDistribution.length === 0) {
      this.chartData = [];
      this.hasData = false;
      return;
    }

    this.hasData = true;
    this.chartData = this.languageDistribution.map((entry) => ({
      name: entry.language,
      value: Math.round(entry.proportion * 100 * 10) / 10,
    }));

    // Adjust chart height based on number of languages (min 160, ~36px per bar)
    this.chartHeight = Math.max(160, this.chartData.length * 36 + 40);
  }
}
