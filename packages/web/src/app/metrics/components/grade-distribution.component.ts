import { Component, Input } from '@angular/core';
import { RepositoryGrade, RepositorySummary } from '../models/metrics.models';

interface GradeCategory {
  label: string;
  color: string;
  count: number;
}

@Component({
  selector: 'app-grade-distribution',
  template: `
    <div class="distribution-card">
      <div class="card-header">
        <span class="card-title">Grade Distribution</span>
        <span class="card-subtitle">Repos by health rating</span>
      </div>

      <div class="pills-row">
        <div
          class="grade-pill"
          *ngFor="let cat of categories; let i = index"
          [style.--pill-color]="cat.color"
          [style.animation-delay]="(i * 60) + 'ms'"
        >
          <span class="pill-letter">{{ cat.label }}</span>
          <span class="pill-count">{{ cat.count }}</span>
        </div>
      </div>

      <!-- Decorative bottom accent -->
      <div class="accent-strip">
        <span
          *ngFor="let cat of categories"
          class="accent-segment"
          [style.background]="cat.color"
          [style.flex]="cat.count || 0.15"
        ></span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .distribution-card {
      background: var(--ms-card-bg, #ffffff);
      border-radius: var(--ms-radius, 14px);
      box-shadow: var(--ms-card-shadow, 0 2px 16px rgba(30, 60, 52, 0.07));
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 180px;
    }

    /* ── Header ── */
    .card-header {
      padding: 24px 28px 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .card-title {
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 18px;
      font-weight: 400;
      color: var(--ms-text, #2c2c2c);
      letter-spacing: 0.2px;
    }

    .card-subtitle {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--ms-text-muted, #7a7a72);
    }

    /* ── Pills row ── */
    .pills-row {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 28px 24px;
      flex-wrap: wrap;
    }

    .grade-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 56px;
      padding: 14px 10px 12px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--pill-color, #7a7a72) 8%, transparent);
      border: 1.5px solid color-mix(in srgb, var(--pill-color, #7a7a72) 18%, transparent);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: pillIn 0.35s ease-out both;
    }

    .grade-pill:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px color-mix(in srgb, var(--pill-color, #7a7a72) 20%, transparent);
    }

    .pill-letter {
      font-family: var(--ms-font-display, 'DM Serif Display', Georgia, serif);
      font-size: 26px;
      font-weight: 400;
      line-height: 1;
      color: var(--pill-color, #7a7a72);
    }

    .pill-count {
      font-family: var(--ms-font-body, 'DM Sans', sans-serif);
      font-size: 13px;
      font-weight: 600;
      color: var(--ms-text, #2c2c2c);
      background: color-mix(in srgb, var(--pill-color, #7a7a72) 12%, transparent);
      padding: 2px 10px;
      border-radius: 20px;
      min-width: 24px;
      text-align: center;
    }

    /* ── Bottom accent strip ── */
    .accent-strip {
      display: flex;
      height: 4px;
      width: 100%;
    }

    .accent-segment {
      transition: flex 0.4s ease;
      opacity: 0.8;
    }

    /* ── Animations ── */
    @keyframes pillIn {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .pills-row {
        gap: 8px;
        padding: 16px 16px 20px;
      }

      .grade-pill {
        min-width: 48px;
        padding: 10px 8px;
      }

      .pill-letter {
        font-size: 22px;
      }

      .pill-count {
        font-size: 12px;
      }
    }
  `],
})
export class GradeDistributionComponent {
  @Input() repositories: RepositorySummary[] = [];

  private static readonly GRADE_COLORS: Record<string, string> = {
    A: '#4caf50',
    B: '#2196f3',
    C: '#ff9800',
    D: '#f57c00',
    E: '#f44336',
    Pending: '#7a7a72',
  };

  private static readonly GRADE_ORDER: string[] = ['A', 'B', 'C', 'D', 'E', 'Pending'];

  get categories(): GradeCategory[] {
    const counts: Record<string, number> = {
      A: 0, B: 0, C: 0, D: 0, E: 0, Pending: 0,
    };

    for (const repo of this.repositories) {
      if (repo.freshnessStatus === 'pending') {
        counts['Pending']++;
      } else if (repo.freshnessGrade) {
        counts[repo.freshnessGrade] = (counts[repo.freshnessGrade] || 0) + 1;
      }
    }

    return GradeDistributionComponent.GRADE_ORDER.map((label) => ({
      label,
      color: GradeDistributionComponent.GRADE_COLORS[label],
      count: counts[label],
    }));
  }
}
