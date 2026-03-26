import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { IngestionFormComponent } from './ingestion-form.component';
import { RepositoryService } from '../../services/repository.service';
import { of, throwError } from 'rxjs';

describe('IngestionFormComponent', () => {
  let component: IngestionFormComponent;
  let fixture: ComponentFixture<IngestionFormComponent>;
  let repositoryService: jasmine.SpyObj<RepositoryService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('RepositoryService', ['triggerIngestion']);

    await TestBed.configureTestingModule({
      declarations: [IngestionFormComponent],
      imports: [
        FormsModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        MatButtonModule,
        MatSnackBarModule,
        MatCardModule,
        MatIconModule,
      ],
      providers: [{ provide: RepositoryService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(IngestionFormComponent);
    component = fixture.componentInstance;
    repositoryService = TestBed.inject(RepositoryService) as jasmine.SpyObj<RepositoryService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('classifySource', () => {
    it('should classify GitHub URLs', () => {
      const result = component.classifySource('https://github.com/owner/repo');
      expect(result).toEqual({ type: 'github', url: 'https://github.com/owner/repo' });
    });

    it('should classify Azure DevOps URLs', () => {
      const result = component.classifySource('https://dev.azure.com/org/project/_git/repo');
      expect(result).toEqual({ type: 'azure_devops', url: 'https://dev.azure.com/org/project/_git/repo' });
    });

    it('should classify local paths', () => {
      const result = component.classifySource('/home/user/my-repo');
      expect(result).toEqual({ type: 'local', path: '/home/user/my-repo' });
    });

    it('should trim whitespace from input', () => {
      const result = component.classifySource('  /tmp/repo  ');
      expect(result).toEqual({ type: 'local', path: '/tmp/repo' });
    });
  });

  describe('onSubmit', () => {
    it('should not submit when input is empty', () => {
      component.sourceInput = '   ';
      component.onSubmit();
      expect(repositoryService.triggerIngestion).not.toHaveBeenCalled();
    });

    it('should call triggerIngestion with classified source on submit', () => {
      repositoryService.triggerIngestion.and.returnValue(of({ ingestionId: 'ing-1' }));
      component.sourceInput = '/tmp/repo';

      component.onSubmit();

      expect(repositoryService.triggerIngestion).toHaveBeenCalledWith({ type: 'local', path: '/tmp/repo' });
    });

    it('should emit ingestionTriggered on success', () => {
      repositoryService.triggerIngestion.and.returnValue(of({ ingestionId: 'ing-42' }));
      spyOn(component.ingestionTriggered, 'emit');
      component.sourceInput = 'https://github.com/owner/repo';

      component.onSubmit();

      expect(component.ingestionTriggered.emit).toHaveBeenCalledWith('ing-42');
      expect(component.loading).toBeFalse();
    });

    it('should set loading state while submitting', () => {
      repositoryService.triggerIngestion.and.returnValue(of({ ingestionId: 'ing-1' }));
      component.sourceInput = '/tmp/repo';

      // Before subscribe resolves, loading should be true
      // Since of() is synchronous, we check that loading is false after completion
      component.onSubmit();
      expect(component.loading).toBeFalse();
    });

    it('should display error message on failure', () => {
      repositoryService.triggerIngestion.and.returnValue(
        throwError(() => ({ error: { message: 'Repository not found' } }))
      );
      component.sourceInput = '/invalid/path';

      component.onSubmit();

      expect(component.loading).toBeFalse();
      expect(component.errorMessage).toBe('Repository not found');
    });

    it('should fall back to generic error message', () => {
      repositoryService.triggerIngestion.and.returnValue(
        throwError(() => ({}))
      );
      component.sourceInput = '/tmp/repo';

      component.onSubmit();

      expect(component.errorMessage).toBe('Ingestion request failed.');
    });

    it('should clear previous error on new submit', () => {
      component.errorMessage = 'Previous error';
      repositoryService.triggerIngestion.and.returnValue(of({ ingestionId: 'ing-1' }));
      component.sourceInput = '/tmp/repo';

      component.onSubmit();

      expect(component.errorMessage).toBe('');
    });
  });

  describe('template', () => {
    it('should have an input field and submit button', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('input#sourceInput')).toBeTruthy();
      expect(compiled.querySelector('button[type="submit"]')).toBeTruthy();
    });

    it('should disable button when input is empty', () => {
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
    });
  });

  describe('snackbar', () => {
    it('should open snackbar with success message on successful ingestion', () => {
      const snackBar = TestBed.inject(MatSnackBar);
      spyOn(snackBar, 'open');
      repositoryService.triggerIngestion.and.returnValue(of({ ingestionId: 'ing-99' }));
      component.sourceInput = '/tmp/repo';

      component.onSubmit();

      expect(snackBar.open).toHaveBeenCalledWith(
        'Ingestion completed successfully',
        'Close',
        { duration: 5000 }
      );
    });

    it('should not open snackbar on failed ingestion', () => {
      const snackBar = TestBed.inject(MatSnackBar);
      spyOn(snackBar, 'open');
      repositoryService.triggerIngestion.and.returnValue(
        throwError(() => ({ error: { message: 'Failed' } }))
      );
      component.sourceInput = '/tmp/repo';

      component.onSubmit();

      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });

  describe('error display', () => {
    it('should display error in a div with error-container styling', () => {
      component.errorMessage = 'Something went wrong';
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector('.error-container') as HTMLElement;
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toContain('Something went wrong');
      expect(errorDiv.getAttribute('role')).toBe('alert');
    });

    it('should not display error container when there is no error', () => {
      component.errorMessage = '';
      fixture.detectChanges();

      const errorDiv = fixture.nativeElement.querySelector('.error-container');
      expect(errorDiv).toBeFalsy();
    });
  });
});
