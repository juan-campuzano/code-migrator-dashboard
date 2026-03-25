import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Subject, of, throwError } from 'rxjs';
import { SimpleChange } from '@angular/core';

import { RepositorySelectorComponent } from './repository-selector.component';
import { RepositoryService } from '../../services/repository.service';
import { Repository } from '../../models/repository.models';

const mockRepositories: Repository[] = [
  { id: 'repo-1', name: 'My Local Repo', sourceType: 'local', sourceIdentifier: '/path/to/repo', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'repo-2', name: 'GitHub Repo', sourceType: 'github', sourceIdentifier: 'https://github.com/owner/repo', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'repo-3', name: 'Azure Repo', sourceType: 'azure_devops', sourceIdentifier: 'https://dev.azure.com/org/project', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
];

describe('RepositorySelectorComponent', () => {
  let component: RepositorySelectorComponent;
  let fixture: ComponentFixture<RepositorySelectorComponent>;
  let repositoryService: jasmine.SpyObj<RepositoryService>;

  function createComponent(listReturn: any = of(mockRepositories)) {
    const spy = jasmine.createSpyObj('RepositoryService', ['listRepositories']);
    spy.listRepositories.and.returnValue(listReturn);

    TestBed.configureTestingModule({
      declarations: [RepositorySelectorComponent],
      imports: [
        CommonModule,
        NoopAnimationsModule,
        MatIconModule,
      ],
      providers: [{ provide: RepositoryService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(RepositorySelectorComponent);
    component = fixture.componentInstance;
    repositoryService = TestBed.inject(RepositoryService) as jasmine.SpyObj<RepositoryService>;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('loading state', () => {
    it('should show loading hint while repositories are being fetched', () => {
      const subject = new Subject<Repository[]>();
      createComponent(subject.asObservable());

      fixture.detectChanges();

      expect(component.loading).toBeTrue();
      const hint = fixture.nativeElement.querySelector('.loading-hint');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('Loading repositories');

      subject.next(mockRepositories);
      subject.complete();
      fixture.detectChanges();

      expect(component.loading).toBeFalse();
      const hintAfter = fixture.nativeElement.querySelector('.loading-hint');
      expect(hintAfter).toBeFalsy();
    });

    it('should disable select while loading', () => {
      const subject = new Subject<Repository[]>();
      createComponent(subject.asObservable());
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      expect(select.disabled).toBeTrue();

      subject.next(mockRepositories);
      subject.complete();
      fixture.detectChanges();

      expect(select.disabled).toBeFalse();
    });
  });

  describe('error state', () => {
    it('should display error message on API failure', () => {
      createComponent(throwError(() => ({ error: { message: 'Server error' } })));
      fixture.detectChanges();

      expect(component.loading).toBeFalse();
      expect(component.errorMessage).toBe('Server error');
    });

    it('should fall back to generic error message when no message provided', () => {
      createComponent(throwError(() => ({})));
      fixture.detectChanges();

      expect(component.errorMessage).toBe('Failed to load repositories.');
    });

    it('should disable select on error', () => {
      createComponent(throwError(() => ({ error: { message: 'fail' } })));
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      expect(select.disabled).toBeTrue();
    });
  });

  describe('empty list', () => {
    it('should show "No repositories available" when list is empty', () => {
      createComponent(of([]));
      fixture.detectChanges();

      expect(component.repositories.length).toBe(0);
      const emptyHint = fixture.nativeElement.querySelector('.empty-hint');
      expect(emptyHint).toBeTruthy();
      expect(emptyHint.textContent).toContain('No repositories available');
    });

    it('should disable select when list is empty', () => {
      createComponent(of([]));
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      expect(select.disabled).toBeTrue();
    });
  });

  describe('selection change', () => {
    it('should emit selectionChange with correct repository id when user selects an option', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      spyOn(component.selectionChange, 'emit');
      component.onSelectionChange('repo-2');

      expect(component.selectionChange.emit).toHaveBeenCalledWith('repo-2');
    });

    it('should call listRepositories on init', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(repositoryService.listRepositories).toHaveBeenCalledTimes(1);
    });

    it('should emit selectionChange via native select change event', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      spyOn(component.selectionChange, 'emit');

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      select.value = 'repo-2';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.selectionChange.emit).toHaveBeenCalledWith('repo-2');
    });
  });

  describe('autoSelectId input', () => {
    it('should re-fetch list and auto-select when autoSelectId changes to non-null', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(repositoryService.listRepositories).toHaveBeenCalledTimes(1);

      spyOn(component.selectionChange, 'emit');
      component.autoSelectId = 'repo-1';
      component.ngOnChanges({
        autoSelectId: new SimpleChange(null, 'repo-1', false),
      });
      fixture.detectChanges();

      expect(repositoryService.listRepositories).toHaveBeenCalledTimes(2);
      expect(component.selectedId).toBe('repo-1');
      expect(component.selectionChange.emit).toHaveBeenCalledWith('repo-1');
    });

    it('should not re-fetch when autoSelectId changes to null', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      component.autoSelectId = null;
      component.ngOnChanges({
        autoSelectId: new SimpleChange('repo-1', null, false),
      });

      expect(repositoryService.listRepositories).toHaveBeenCalledTimes(1);
    });
  });

  describe('source type icons', () => {
    it('should return "folder" icon for local source type', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(component.getSourceIcon('local')).toBe('folder');
    });

    it('should return "code" icon for github source type', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(component.getSourceIcon('github')).toBe('code');
    });

    it('should return "cloud" icon for azure_devops source type', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(component.getSourceIcon('azure_devops')).toBe('cloud');
    });

    it('should return "help_outline" for unknown source type', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(component.getSourceIcon('unknown')).toBe('help_outline');
    });

    it('should render options with source type labels', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      const options = fixture.nativeElement.querySelectorAll('option:not([disabled])');
      expect(options.length).toBe(3);
      expect(options[0].textContent).toContain('Local');
      expect(options[1].textContent).toContain('GitHub');
      expect(options[2].textContent).toContain('Azure');
    });
  });

  describe('placeholder text', () => {
    it('should return "Loading…" when loading', () => {
      const subject = new Subject<Repository[]>();
      createComponent(subject.asObservable());
      fixture.detectChanges();

      expect(component.getPlaceholder()).toBe('Loading…');
      subject.complete();
    });

    it('should return "Error loading repositories" on error', () => {
      createComponent(throwError(() => ({ error: { message: 'fail' } })));
      fixture.detectChanges();

      expect(component.getPlaceholder()).toBe('Error loading repositories');
    });

    it('should return "No repositories available" when list is empty', () => {
      createComponent(of([]));
      fixture.detectChanges();

      expect(component.getPlaceholder()).toBe('No repositories available');
    });

    it('should return "Choose a repository…" when repos are loaded', () => {
      createComponent(of(mockRepositories));
      fixture.detectChanges();

      expect(component.getPlaceholder()).toBe('Choose a repository…');
    });
  });
});
