import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { MetricsSummaryComponent } from './metrics-summary.component';
import { PortfolioScoreComponent } from './components/portfolio-score.component';
import { RepositoryTableComponent } from './components/repository-table.component';
import { LanguageChartComponent } from './components/language-chart.component';
import { GradeDistributionComponent } from './components/grade-distribution.component';
import { MetricsService } from './services/metrics.service';

const routes: Routes = [
  { path: '', component: MetricsSummaryComponent },
];

@NgModule({
  declarations: [
    MetricsSummaryComponent,
    PortfolioScoreComponent,
    RepositoryTableComponent,
    LanguageChartComponent,
    GradeDistributionComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NgxChartsModule,
    MatCardModule,
    MatToolbarModule,
    MatButtonModule,
    MatTableModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  providers: [
    MetricsService,
  ],
})
export class MetricsModule {}
