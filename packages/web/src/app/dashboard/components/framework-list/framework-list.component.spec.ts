import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { FrameworkListComponent } from './framework-list.component';
import { RepositoryFramework } from '../../models/repository.models';

describe('FrameworkListComponent', () => {
  let component: FrameworkListComponent;
  let fixture: ComponentFixture<FrameworkListComponent>;

  const sampleFrameworks: RepositoryFramework[] = [
    { name: 'Angular', version: '17.1.0' },
    { name: 'Express', version: '4.18.2' },
    { name: 'Django' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FrameworkListComponent],
      imports: [
        NoopAnimationsModule,
        MatTableModule,
        MatProgressBarModule,
        MatIconModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FrameworkListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('empty state', () => {
    it('should show empty state when frameworks is null', () => {
      component.frameworks = null;
      fixture.detectChanges();

      expect(component.hasFrameworks).toBeFalse();
      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toContain('No frameworks detected');
    });

    it('should show empty state with mat-icon when frameworks is null', () => {
      component.frameworks = null;
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.empty-state mat-icon');
      expect(icon).toBeTruthy();
    });

    it('should show empty state when frameworks is empty array', () => {
      component.frameworks = [];
      fixture.detectChanges();

      expect(component.hasFrameworks).toBeFalse();
      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toContain('No frameworks detected');
    });

    it('should not render mat-table when no frameworks', () => {
      component.frameworks = null;
      fixture.detectChanges();

      const table = fixture.nativeElement.querySelector('mat-table');
      expect(table).toBeFalsy();
    });

    it('should not show empty state when loading', () => {
      component.frameworks = null;
      component.loading = true;
      fixture.detectChanges();

      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeFalsy();
    });
  });

  describe('loading state', () => {
    it('should show mat-progress-bar when loading is true', () => {
      component.loading = true;
      fixture.detectChanges();

      const progressBar = fixture.nativeElement.querySelector('mat-progress-bar');
      expect(progressBar).toBeTruthy();
    });

    it('should hide mat-progress-bar when loading is false', () => {
      component.loading = false;
      fixture.detectChanges();

      const progressBar = fixture.nativeElement.querySelector('mat-progress-bar');
      expect(progressBar).toBeFalsy();
    });

    it('should not show mat-table when loading', () => {
      component.frameworks = sampleFrameworks;
      component.loading = true;
      fixture.detectChanges();

      const table = fixture.nativeElement.querySelector('mat-table');
      expect(table).toBeFalsy();
    });
  });

  describe('mat-table rendering', () => {
    it('should render a mat-table with framework data', () => {
      component.frameworks = sampleFrameworks;
      fixture.detectChanges();

      const table = fixture.nativeElement.querySelector('mat-table');
      expect(table).toBeTruthy();

      const rows = fixture.nativeElement.querySelectorAll('mat-row');
      expect(rows.length).toBe(3);
    });

    it('should display framework names', () => {
      component.frameworks = sampleFrameworks;
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('mat-row');
      expect(rows[0].textContent).toContain('Angular');
      expect(rows[1].textContent).toContain('Express');
      expect(rows[2].textContent).toContain('Django');
    });

    it('should display version when available', () => {
      component.frameworks = sampleFrameworks;
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('mat-row');
      expect(rows[0].textContent).toContain('17.1.0');
      expect(rows[1].textContent).toContain('4.18.2');
    });

    it('should display N/A when version is not available', () => {
      component.frameworks = sampleFrameworks;
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('mat-row');
      expect(rows[2].textContent).toContain('N/A');
    });

    it('should have mat-header-row with column headers', () => {
      component.frameworks = sampleFrameworks;
      fixture.detectChanges();

      const headerRow = fixture.nativeElement.querySelector('mat-header-row');
      expect(headerRow).toBeTruthy();
      expect(headerRow.textContent).toContain('Framework Name');
      expect(headerRow.textContent).toContain('Version');
    });

    it('should not show empty state when frameworks are present', () => {
      component.frameworks = sampleFrameworks;
      fixture.detectChanges();

      const emptyEl = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyEl).toBeFalsy();
    });

    it('should have displayedColumns property with name and version', () => {
      expect(component.displayedColumns).toEqual(['name', 'version']);
    });
  });

  describe('single framework', () => {
    it('should handle a single framework', () => {
      component.frameworks = [{ name: 'React', version: '18.2.0' }];
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('mat-row');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('React');
      expect(rows[0].textContent).toContain('18.2.0');
    });
  });
});
