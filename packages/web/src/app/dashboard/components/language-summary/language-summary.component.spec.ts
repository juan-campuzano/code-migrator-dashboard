import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { LanguageSummaryComponent } from './language-summary.component';
import { RepositoryLanguage } from '../../models/repository.models';

describe('LanguageSummaryComponent', () => {
  let component: LanguageSummaryComponent;
  let fixture: ComponentFixture<LanguageSummaryComponent>;

  const sampleLanguages: RepositoryLanguage[] = [
    { language: 'TypeScript', fileCount: 50, proportion: 0.5 },
    { language: 'JavaScript', fileCount: 30, proportion: 0.3 },
    { language: 'CSS', fileCount: 20, proportion: 0.2 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LanguageSummaryComponent],
      imports: [NgxChartsModule, NoopAnimationsModule, MatProgressBarModule, MatIconModule],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSummaryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('empty state', () => {
    it('should show empty state when languages is null', () => {
      component.languages = null;
      component.ngOnChanges();
      fixture.detectChanges();

      expect(component.hasLanguages).toBeFalse();
      expect(component.chartData).toEqual([]);
      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toContain('No languages detected');
    });

    it('should show empty state when languages is empty array', () => {
      component.languages = [];
      component.ngOnChanges();
      fixture.detectChanges();

      expect(component.hasLanguages).toBeFalse();
      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeTruthy();
    });
  });

  describe('chart rendering', () => {
    it('should transform languages into chart data', () => {
      component.languages = sampleLanguages;
      component.ngOnChanges();

      expect(component.hasLanguages).toBeTrue();
      expect(component.chartData.length).toBe(3);
      expect(component.chartData).toEqual([
        { name: 'TypeScript', value: 50 },
        { name: 'JavaScript', value: 30 },
        { name: 'CSS', value: 20 },
      ]);
    });

    it('should not show empty state when languages are present', () => {
      component.languages = sampleLanguages;
      component.ngOnChanges();
      fixture.detectChanges();

      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeFalsy();
    });

    it('should render the chart element when languages are present', () => {
      component.languages = sampleLanguages;
      component.ngOnChanges();
      fixture.detectChanges();

      const chart = fixture.nativeElement.querySelector('ngx-charts-bar-vertical');
      expect(chart).toBeTruthy();
    });

    it('should handle single language', () => {
      component.languages = [{ language: 'Python', fileCount: 10, proportion: 1.0 }];
      component.ngOnChanges();

      expect(component.chartData).toEqual([{ name: 'Python', value: 100 }]);
    });

    it('should round proportion percentages to two decimal places', () => {
      component.languages = [
        { language: 'Rust', fileCount: 3, proportion: 0.3333 },
      ];
      component.ngOnChanges();

      expect(component.chartData[0].value).toBe(33.33);
    });
  });

  describe('data updates', () => {
    it('should update chart when languages input changes', () => {
      component.languages = sampleLanguages;
      component.ngOnChanges();
      expect(component.chartData.length).toBe(3);

      component.languages = [{ language: 'Go', fileCount: 5, proportion: 1.0 }];
      component.ngOnChanges();
      expect(component.chartData.length).toBe(1);
      expect(component.chartData[0].name).toBe('Go');
    });

    it('should switch to empty state when languages cleared', () => {
      component.languages = sampleLanguages;
      component.ngOnChanges();
      expect(component.hasLanguages).toBeTrue();

      component.languages = [];
      component.ngOnChanges();
      expect(component.hasLanguages).toBeFalse();
      expect(component.chartData).toEqual([]);
    });
  });
});
