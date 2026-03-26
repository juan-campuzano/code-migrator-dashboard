import { Component, Input } from '@angular/core';
import { RepositoryGrade } from '../models/metrics.models';

@Component({
  selector: 'app-portfolio-score',
  template: `
    <!-- Loading State -->
    <div class="score-card" *ngIf="loading">
      <div class="loading-wrap">
        <mat-progress-spinner
          mode="indeterminate"
          diameter="48"
          strokeWidth="4"
          color="primary"
        ></mat-progress-spinner>
        <span class="loading-label">Calculating score&hellip;</span>
      </div>
    </div>

    <!-- Score Display -->
    <div class="score-card" *ngIf="!loading">
      <div class="card-inner">
        <!-- Hero grade letter -->
        <div class="grade-hero" [style.--grade-color]="gradeColor">
          <div class="grade-glow"></div>
          <span class="grade-letter">{{ portfolioGrade || '–' }}</span>
        </div>

        <!-- Score details -->
        <div class="score-details">
          <div class="score-row">
            <span class="score-label">Portfolio Score</span>
            <span class="score-value" [style.color]="gradeColor">
              {{ portfolioScore | number:'1.1-1' }}
            </span>
          </div>
          <div class="score-divider"></div>
          <div class="repo-count-row">
            <span class="repo-count-number">{{ totalRepositories }}</span>
            <span class="repo-count-label">
              {{ totalRepositories === 1 ? 'Repository' : 'Repositories' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Decorative bottom bar -->
      <div class="grade-bar" [style.background]="gradeColor"></div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .score-card {
      background: var(--ms-card-bg, #ffffff);
      border-radius: var(--ms-radius, 14px);
      box-shadow: var(--ms-card-shadow, 0 2px 16px rgba(30, 60, 52, 0.07));
      overflow: hidden;
      position: relative;
      min-height: 180px;
      display: flex;
      flex-direction: column;
    }

    /* ── Loading ── */
    .loading-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 40px 24px;
    }

    .loading-label {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 13px;
      color: var(--ms-text-muted, #7a7a72);
      letter-spacing: 0.3px;
    }

    /* ── Card inner layout ── */
    .card-inner {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 32px;
      padding: 28px 32px 24px;
    }

    /* ── Hero grade letter ── */
    .grade-hero {
      position: relative;
      width: 100px;
      height: 100px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .grade-glow {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: var(--grade-color, #7a7a72);
      opacity: 0.1;
      animation: pulseGlow 3s ease-in-out infinite;
    }

    .grade-letter {
      position: relative;
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 64px;
      font-weight: 400;
      line-height: 1;
      color: var(--grade-color, #7a7a72);
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
      z-index: 1;
    }

    /* ── Score details ── */
    .score-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .score-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .score-label {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--ms-text-muted, #7a7a72);
    }

    .score-value {
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 36px;
      font-weight: 400;
      line-height: 1.1;
    }

    .score-divider {
      width: 40px;
      height: 2px;
      background: var(--ms-accent, #d4a24e);
      border-radius: 1px;
      opacity: 0.5;
    }

    .repo-count-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .repo-count-number {
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 22px;
      color: var(--ms-text, #2c2c2c);
      line-height: 1;
    }

    .repo-count-label {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 13px;
      color: var(--ms-text-muted, #7a7a72);
      letter-spacing: 0.2px;
    }

    /* ── Bottom accent bar ── */
    .grade-bar {
      height: 4px;
      width: 100%;
      opacity: 0.85;
    }

    /* ── Animations ── */
    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); opacity: 0.1; }
      50% { transform: scale(1.08); opacity: 0.16; }
    }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .card-inner {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 16px;
        padding: 24px 20px 20px;
      }

      .grade-hero {
        width: 80px;
        height: 80px;
      }

      .grade-letter {
        font-size: 52px;
      }

      .score-value {
        font-size: 28px;
      }

      .score-divider {
        margin: 0 auto;
      }

      .repo-count-row {
        justify-content: center;
      }
    }
  `],
})
export class PortfolioScoreComponent {
  @Input() portfolioGrade: RepositoryGrade | null = null;
  @Input() portfolioScore: number = 0;
  @Input() totalRepositories: number = 0;
  @Input() loading: boolean = false;

  private static readonly GRADE_COLORS: Record<RepositoryGrade, string> = {
    A: '#4caf50',
    B: '#2196f3',
    C: '#ff9800',
    D: '#f57c00',
    E: '#f44336',
  };

  get gradeColor(): string {
    if (!this.portfolioGrade) {
      return '#7a7a72';
    }
    return PortfolioScoreComponent.GRADE_COLORS[this.portfolioGrade] ?? '#7a7a72';
  }
}
