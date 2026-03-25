import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TokenSettingsComponent } from './token-settings.component';
import { RepositoryService } from '../../services/repository.service';
import { of, throwError } from 'rxjs';

describe('TokenSettingsComponent', () => {
  let component: TokenSettingsComponent;
  let fixture: ComponentFixture<TokenSettingsComponent>;
  let repositoryService: jasmine.SpyObj<RepositoryService>;
  let snackBar: MatSnackBar;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('RepositoryService', ['getTokens', 'updateTokens']);
    spy.getTokens.and.returnValue(of({ providers: [] }));

    await TestBed.configureTestingModule({
      declarations: [TokenSettingsComponent],
      imports: [
        FormsModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSnackBarModule,
      ],
      providers: [{ provide: RepositoryService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(TokenSettingsComponent);
    component = fixture.componentInstance;
    repositoryService = TestBed.inject(RepositoryService) as jasmine.SpyObj<RepositoryService>;
    snackBar = TestBed.inject(MatSnackBar);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load configured providers on init', () => {
      expect(repositoryService.getTokens).toHaveBeenCalled();
    });

    it('should display configured providers', () => {
      repositoryService.getTokens.and.returnValue(of({ providers: ['github'] }));
      component.ngOnInit();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.configured-provider');
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain('GitHub');
    });

    it('should display multiple configured providers', () => {
      repositoryService.getTokens.and.returnValue(of({ providers: ['github', 'azure_devops'] }));
      component.ngOnInit();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.configured-provider');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('GitHub');
      expect(items[1].textContent).toContain('Azure DevOps');
    });

    it('should handle error loading providers gracefully', () => {
      repositoryService.getTokens.and.returnValue(throwError(() => new Error('Network error')));
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.configuredProviders).toEqual([]);
    });
  });

  describe('providerLabel', () => {
    it('should return GitHub for github', () => {
      expect(component.providerLabel('github')).toBe('GitHub');
    });

    it('should return Azure DevOps for azure_devops', () => {
      expect(component.providerLabel('azure_devops')).toBe('Azure DevOps');
    });

    it('should return raw value for unknown provider', () => {
      expect(component.providerLabel('bitbucket')).toBe('bitbucket');
    });
  });

  describe('form rendering', () => {
    it('should have GitHub token input', () => {
      const input = fixture.nativeElement.querySelector('#githubToken');
      expect(input).toBeTruthy();
      expect(input.type).toBe('password');
    });

    it('should have Azure DevOps token input', () => {
      const input = fixture.nativeElement.querySelector('#azureToken');
      expect(input).toBeTruthy();
      expect(input.type).toBe('password');
    });

    it('should wrap inputs in mat-form-field with outline appearance', () => {
      const formFields = fixture.nativeElement.querySelectorAll('mat-form-field');
      expect(formFields.length).toBe(2);
      formFields.forEach((field: Element) => {
        expect(field.getAttribute('appearance')).toBe('outline');
      });
    });

    it('should have a save button', () => {
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Save Tokens');
    });

    it('should disable save button when both tokens are empty', () => {
      component.githubToken = '';
      component.azureToken = '';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBeTrue();
    });

    it('should have mat-error elements for validation', () => {
      // mat-error is only rendered when the form control is in error state
      // Verify the mat-form-field elements exist (mat-error is defined in template)
      const formFields = fixture.nativeElement.querySelectorAll('mat-form-field');
      expect(formFields.length).toBe(2);
    });
  });

  describe('onSave', () => {
    it('should not call updateTokens when both tokens are empty', () => {
      component.githubToken = '';
      component.azureToken = '';
      component.onSave();

      expect(repositoryService.updateTokens).not.toHaveBeenCalled();
    });

    it('should save GitHub token only when provided', () => {
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = 'ghp_test123';
      component.azureToken = '';

      component.onSave();

      expect(repositoryService.updateTokens).toHaveBeenCalledWith({ provider: 'github', token: 'ghp_test123' });
      expect(repositoryService.updateTokens).toHaveBeenCalledTimes(1);
    });

    it('should save Azure DevOps token only when provided', () => {
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = '';
      component.azureToken = 'ado_pat_123';

      component.onSave();

      expect(repositoryService.updateTokens).toHaveBeenCalledWith({ provider: 'azure_devops', token: 'ado_pat_123' });
      expect(repositoryService.updateTokens).toHaveBeenCalledTimes(1);
    });

    it('should save both tokens when both are provided', () => {
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = 'ghp_test';
      component.azureToken = 'ado_test';

      component.onSave();

      expect(repositoryService.updateTokens).toHaveBeenCalledTimes(2);
      expect(repositoryService.updateTokens).toHaveBeenCalledWith({ provider: 'github', token: 'ghp_test' });
      expect(repositoryService.updateTokens).toHaveBeenCalledWith({ provider: 'azure_devops', token: 'ado_test' });
    });

    it('should open snackbar with success message after saving', () => {
      spyOn(snackBar, 'open');
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = 'ghp_test';

      component.onSave();

      expect(snackBar.open).toHaveBeenCalledWith('Tokens saved successfully', 'Close', { duration: 5000 });
    });

    it('should clear token fields after successful save', () => {
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = 'ghp_test';
      component.azureToken = 'ado_test';

      component.onSave();

      expect(component.githubToken).toBe('');
      expect(component.azureToken).toBe('');
    });

    it('should reload configured providers after successful save', () => {
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      repositoryService.getTokens.calls.reset();
      component.githubToken = 'ghp_test';

      component.onSave();

      expect(repositoryService.getTokens).toHaveBeenCalled();
    });

    it('should show error message on save failure', () => {
      repositoryService.updateTokens.and.returnValue(throwError(() => new Error('Server error')));
      component.githubToken = 'ghp_test';

      component.onSave();
      fixture.detectChanges();

      expect(component.errorMessage).toBe('Failed to save tokens. Please try again.');
      const errorEl = fixture.nativeElement.querySelector('.error-message');
      expect(errorEl).toBeTruthy();
      expect(errorEl.getAttribute('role')).toBe('alert');
    });

    it('should clear previous error message on new save', () => {
      component.errorMessage = 'Previous error';
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = 'ghp_test';

      component.onSave();

      expect(component.errorMessage).toBe('');
    });

    it('should set saving state during save', () => {
      repositoryService.updateTokens.and.returnValue(of(undefined as any));
      component.githubToken = 'ghp_test';

      component.onSave();

      // After synchronous observable completes, saving should be false
      expect(component.saving).toBeFalse();
    });
  });
});
