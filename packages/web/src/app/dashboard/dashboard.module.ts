import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { IngestionFormComponent } from './components/ingestion-form/ingestion-form.component';
import { IngestionStatusComponent } from './components/ingestion-status/ingestion-status.component';
import { LanguageSummaryComponent } from './components/language-summary/language-summary.component';
import { FrameworkListComponent } from './components/framework-list/framework-list.component';
import { ErrorBannerComponent } from './components/error-banner/error-banner.component';
import { TokenSettingsComponent } from './components/token-settings/token-settings.component';
import { MigrationTriggerComponent } from './components/migration-trigger/migration-trigger.component';
import { RepositorySelectorComponent } from './components/repository-selector/repository-selector.component';
import { FreshnessGradeComponent } from './components/freshness-grade/freshness-grade.component';
import { FreshnessTableComponent } from './components/freshness-table/freshness-table.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RepositoryService } from './services/repository.service';
import { MigrationService } from './services/migration.service';

const routes: Routes = [
  { path: '', component: DashboardComponent },
];

@NgModule({
  declarations: [
    DashboardComponent,
    IngestionFormComponent,
    IngestionStatusComponent,
    LanguageSummaryComponent,
    FrameworkListComponent,
    ErrorBannerComponent,
    TokenSettingsComponent,
    MigrationTriggerComponent,
    RepositorySelectorComponent,
    FreshnessGradeComponent,
    FreshnessTableComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    NgxChartsModule,
    MatCardModule,
    MatToolbarModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatTableModule,
    MatIconModule,
    MatSelectModule,
    MatSortModule,
    MatProgressSpinnerModule,
  ],
  providers: [
    RepositoryService,
    MigrationService,
  ],
})
export class DashboardModule {}
