import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { DependencyPanelComponent, EcosystemGroup } from './dependency-panel.component';
import { RepositoryDependency } from '../../models/repository.models';

function setDependencies(
  component: DependencyPanelComponent,
  fixture: ComponentFixture<DependencyPanelComponent>,
  deps: RepositoryDependency[] | null
): void {
  component.dependencies = deps;
  component.ngOnChanges();
  fixture.detectChanges();
}

describe('DependencyPanelComponent', () => {
  let component: DependencyPanelComponent;
  let fixture: ComponentFixture<DependencyPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DependencyPanelComponent],
      imports: [
        CommonModule,
        NoopAnimationsModule,
        MatExpansionModule,
        MatTableModule,
        MatProgressBarModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DependencyPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('loading state', () => {
    it('should show mat-progress-bar when loading is true', () => {
      component.loading = true;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('mat-progress-bar')).toBeTruthy();
    });

    it('should hide mat-progress-bar when loading is false', () => {
      component.loading = false;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('mat-progress-bar')).toBeNull();
    });
  });

  describe('empty state', () => {
    it('should show empty state with mat-icon when dependencies is null', () => {
      setDependencies(component, fixture, null);

      const el: HTMLElement = fixture.nativeElement;
      const emptyState = el.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState!.textContent).toContain('No dependencies found');
      expect(emptyState!.querySelector('mat-icon')).toBeTruthy();
    });

    it('should show empty state when dependencies is empty array', () => {
      setDependencies(component, fixture, []);

      const el: HTMLElement = fixture.nativeElement;
      const emptyState = el.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState!.textContent).toContain('No dependencies found');
    });

    it('should not show expansion panels when no dependencies', () => {
      setDependencies(component, fixture, null);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('mat-expansion-panel')).toBeNull();
    });
  });

  describe('grouping by ecosystem', () => {
    const mixedDeps: RepositoryDependency[] = [
      { ecosystem: 'npm', name: 'express', versionConstraint: '^4.18.0', dependencyType: 'production' },
      { ecosystem: 'npm', name: 'jest', versionConstraint: '^29.0.0', dependencyType: 'development' },
      { ecosystem: 'pip', name: 'django', versionConstraint: '>=4.0', dependencyType: 'production' },
      { ecosystem: 'maven', name: 'spring-boot', versionConstraint: '3.1.0', dependencyType: 'production' },
      { ecosystem: 'pip', name: 'pytest', versionConstraint: '>=7.0', dependencyType: 'development' },
    ];

    beforeEach(() => {
      setDependencies(component, fixture, mixedDeps);
    });

    it('should group dependencies by ecosystem', () => {
      expect(component.ecosystemGroups.length).toBe(3);
      const ecosystems = component.ecosystemGroups.map(g => g.ecosystem);
      expect(ecosystems).toEqual(['maven', 'npm', 'pip']);
    });

    it('should sort ecosystem groups alphabetically', () => {
      const ecosystems = component.ecosystemGroups.map(g => g.ecosystem);
      expect(ecosystems).toEqual(['maven', 'npm', 'pip']);
    });

    it('should have correct dependency count per ecosystem', () => {
      const npmGroup = component.ecosystemGroups.find(g => g.ecosystem === 'npm')!;
      const pipGroup = component.ecosystemGroups.find(g => g.ecosystem === 'pip')!;
      const mavenGroup = component.ecosystemGroups.find(g => g.ecosystem === 'maven')!;

      expect(npmGroup.dependencies.length).toBe(2);
      expect(pipGroup.dependencies.length).toBe(2);
      expect(mavenGroup.dependencies.length).toBe(1);
    });

    it('should render mat-expansion-panel per ecosystem group', () => {
      const el: HTMLElement = fixture.nativeElement;
      const panels = el.querySelectorAll('mat-expansion-panel');
      expect(panels.length).toBe(3);
    });

    it('should display ecosystem name in panel header', () => {
      const el: HTMLElement = fixture.nativeElement;
      const titles = el.querySelectorAll('mat-panel-title');
      const titleTexts = Array.from(titles).map(t => t.textContent!.trim());
      expect(titleTexts).toContain('maven');
      expect(titleTexts).toContain('npm');
      expect(titleTexts).toContain('pip');
    });

    it('should display dependency count in panel description', () => {
      const el: HTMLElement = fixture.nativeElement;
      const descriptions = el.querySelectorAll('mat-panel-description');
      const descTexts = Array.from(descriptions).map(d => d.textContent!.trim());
      expect(descTexts).toContain('1 dependencies');
      expect(descTexts).toContain('2 dependencies');
    });

    it('should not show empty state when dependencies exist', () => {
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.empty-state')).toBeNull();
    });
  });

  describe('mat-table rendering', () => {
    const deps: RepositoryDependency[] = [
      { ecosystem: 'npm', name: 'express', versionConstraint: '^4.18.0', dependencyType: 'production' },
      { ecosystem: 'npm', name: 'jest', dependencyType: 'development' },
    ];

    beforeEach(() => {
      setDependencies(component, fixture, deps);
    });

    it('should have depColumns defined', () => {
      expect(component.depColumns).toEqual(['name', 'version', 'type']);
    });

    it('should render mat-table inside expansion panel', () => {
      const el: HTMLElement = fixture.nativeElement;
      const table = el.querySelector('mat-table');
      expect(table).toBeTruthy();
    });

    it('should render mat-header-row with column headers', () => {
      const el: HTMLElement = fixture.nativeElement;
      const headerCells = el.querySelectorAll('mat-header-cell');
      const headerTexts = Array.from(headerCells).map(c => c.textContent!.trim());
      expect(headerTexts).toContain('Name');
      expect(headerTexts).toContain('Version');
      expect(headerTexts).toContain('Type');
    });

    it('should render mat-row for each dependency', () => {
      const el: HTMLElement = fixture.nativeElement;
      const rows = el.querySelectorAll('mat-row');
      expect(rows.length).toBe(2);
    });

    it('should display N/A when versionConstraint is missing', () => {
      const el: HTMLElement = fixture.nativeElement;
      const cells = el.querySelectorAll('mat-cell');
      const cellTexts = Array.from(cells).map(c => c.textContent!.trim());
      expect(cellTexts).toContain('N/A');
    });
  });

  describe('expand/collapse all', () => {
    beforeEach(() => {
      setDependencies(component, fixture, [
        { ecosystem: 'npm', name: 'express', versionConstraint: '^4.0.0', dependencyType: 'production' },
        { ecosystem: 'pip', name: 'django', versionConstraint: '>=4.0', dependencyType: 'production' },
      ]);
    });

    it('should have Expand All and Collapse All buttons', () => {
      const el: HTMLElement = fixture.nativeElement;
      const buttons = el.querySelectorAll('.panel-actions button');
      expect(buttons.length).toBe(2);
      const buttonTexts = Array.from(buttons).map(b => b.textContent!.trim());
      expect(buttonTexts).toContain('Expand All');
      expect(buttonTexts).toContain('Collapse All');
    });

    it('should have @ViewChild accordion reference', () => {
      expect(component.accordion).toBeTruthy();
    });
  });

  describe('input changes', () => {
    it('should update groups when dependencies input changes', () => {
      setDependencies(component, fixture, [
        { ecosystem: 'npm', name: 'express', versionConstraint: '^4.0.0', dependencyType: 'production' },
      ]);
      expect(component.ecosystemGroups.length).toBe(1);

      setDependencies(component, fixture, [
        { ecosystem: 'npm', name: 'express', versionConstraint: '^4.0.0', dependencyType: 'production' },
        { ecosystem: 'cargo', name: 'serde', versionConstraint: '1.0', dependencyType: 'production' },
      ]);
      expect(component.ecosystemGroups.length).toBe(2);
    });

    it('should clear groups when dependencies set to null', () => {
      setDependencies(component, fixture, [
        { ecosystem: 'npm', name: 'express', versionConstraint: '^4.0.0', dependencyType: 'production' },
      ]);
      expect(component.hasDependencies).toBeTrue();

      setDependencies(component, fixture, null);
      expect(component.hasDependencies).toBeFalse();
      expect(component.ecosystemGroups.length).toBe(0);
    });
  });
});
