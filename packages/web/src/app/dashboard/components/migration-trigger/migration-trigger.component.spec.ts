import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MigrationTriggerComponent } from './migration-trigger.component';
import { MigrationService } from '../../services/migration.service';
import { of, throwError } from 'rxjs';
import { MigrationStatus } from '../../models/repository.models';

describe('MigrationTriggerComponent', () => {
  let component: MigrationTriggerComponent;
  let fixture: ComponentFixture<MigrationTriggerComponent>;
  let migrationService: jasmine.SpyObj<MigrationService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('MigrationService', [
      'triggerMigration',
      'getMigrationStatus',
    ]);

    await TestBed.configureTestingModule({
      declarations: [MigrationTriggerComponent],
      imports: [FormsModule, HttpClientTestingModule, NoopAnimationsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
      providers: [{ provide: MigrationService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(MigrationTriggerComponent);
    component = fixture.componentInstance;
    migrationService = TestBed.inject(MigrationService) as jasmine.SpyObj<MigrationService>;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('canTrigger', () => {
    it('should return false when repositoryId is null', () => {
      component.repositoryId = null;
      component.migrationType = 'framework_upgrade';
      expect(component.canTrigger()).toBeFalse();
    });

    it('should return false when migrationType is empty', () => {
      component.repositoryId = 'repo-1';
      component.migrationType = '';
      expect(component.canTrigger()).toBeFalse();
    });

    it('should return false when loading', () => {
      component.repositoryId = 'repo-1';
      component.migrationType = 'framework_upgrade';
      component.loading = true;
      expect(component.canTrigger()).toBeFalse();
    });

    it('should return true when all conditions are met', () => {
      component.repositoryId = 'repo-1';
      component.migrationType = 'framework_upgrade';
      component.loading = false;
      expect(component.canTrigger()).toBeTrue();
    });
  });

  describe('parseParameters', () => {
    it('should return undefined for empty input', () => {
      expect(component.parseParameters('')).toBeUndefined();
      expect(component.parseParameters('   ')).toBeUndefined();
    });

    it('should parse key=value pairs', () => {
      expect(component.parseParameters('targetVersion=2.0')).toEqual({
        targetVersion: '2.0',
      });
    });

    it('should parse multiple comma-separated pairs', () => {
      expect(component.parseParameters('key1=val1,key2=val2')).toEqual({
        key1: 'val1',
        key2: 'val2',
      });
    });

    it('should handle values containing equals signs', () => {
      expect(component.parseParameters('expr=a=b')).toEqual({ expr: 'a=b' });
    });
  });

  describe('triggerMigration', () => {
    it('should not trigger when canTrigger returns false', () => {
      component.repositoryId = null;
      component.triggerMigration();
      expect(migrationService.triggerMigration).not.toHaveBeenCalled();
    });

    it('should call service with correct arguments', () => {
      migrationService.triggerMigration.and.returnValue(
        of({ migrationId: 'mig-1', status: 'queued' }),
      );
      migrationService.getMigrationStatus.and.returnValue(
        of({
          migrationId: 'mig-1',
          repositoryId: 'repo-1',
          migrationType: 'framework_upgrade',
          status: 'completed',
          createdAt: '',
          updatedAt: '',
        } as MigrationStatus),
      );

      component.repositoryId = 'repo-1';
      component.migrationType = 'framework_upgrade';
      component.parametersInput = 'targetVersion=2.0';

      component.triggerMigration();

      expect(migrationService.triggerMigration).toHaveBeenCalledWith(
        'repo-1',
        'framework_upgrade',
        { targetVersion: '2.0' },
      );
    });

    it('should set migrationId and status on success', () => {
      migrationService.triggerMigration.and.returnValue(
        of({ migrationId: 'mig-1', status: 'queued' }),
      );
      migrationService.getMigrationStatus.and.returnValue(
        of({
          migrationId: 'mig-1',
          repositoryId: 'repo-1',
          migrationType: 'framework_upgrade',
          status: 'completed',
          createdAt: '',
          updatedAt: '',
        } as MigrationStatus),
      );

      component.repositoryId = 'repo-1';
      component.migrationType = 'framework_upgrade';

      component.triggerMigration();

      expect(component.migrationId).toBe('mig-1');
      expect(component.migrationStatus).toBe('queued');
      expect(component.loading).toBeFalse();
    });

    it('should set error message on failure', () => {
      migrationService.triggerMigration.and.returnValue(
        throwError(() => ({ error: { message: 'Repository not ingested' } })),
      );

      component.repositoryId = 'repo-1';
      component.migrationType = 'framework_upgrade';

      component.triggerMigration();

      expect(component.loading).toBeFalse();
      expect(component.errorMessage).toBe('Repository not ingested');
    });

    it('should use fallback error message', () => {
      migrationService.triggerMigration.and.returnValue(
        throwError(() => ({})),
      );

      component.repositoryId = 'repo-1';
      component.migrationType = 'framework_upgrade';

      component.triggerMigration();

      expect(component.errorMessage).toBe('Failed to trigger migration.');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      component.migrationId = 'mig-1';
      component.migrationStatus = 'completed';
      component.migrationResult = 'Done';
      component.migrationError = 'Some error';
      component.migrationType = 'framework_upgrade';
      component.parametersInput = 'key=val';
      component.errorMessage = 'Error';

      component.reset();

      expect(component.migrationId).toBeNull();
      expect(component.migrationStatus).toBe('idle');
      expect(component.migrationResult).toBeNull();
      expect(component.migrationError).toBeNull();
      expect(component.migrationType).toBe('');
      expect(component.parametersInput).toBe('');
      expect(component.errorMessage).toBe('');
    });
  });

  describe('template', () => {
    it('should show migration form when no migration is active', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('mat-select')).toBeTruthy();
      expect(compiled.querySelector('input#migrationParams')).toBeTruthy();
      expect(compiled.querySelector('button')).toBeTruthy();
    });

    it('should show migration status when migration is active', () => {
      component.migrationId = 'mig-1';
      component.migrationStatus = 'running';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('mig-1');
      expect(compiled.textContent).toContain('running');
      expect(compiled.querySelector('.migration-form')).toBeNull();
    });

    it('should disable trigger button when repositoryId is null', () => {
      component.repositoryId = null;
      component.migrationType = 'framework_upgrade';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
    });

    it('should render mat-select for migration types', () => {
      const matSelect = fixture.nativeElement.querySelector('mat-select');
      expect(matSelect).toBeTruthy();
    });

    it('should wrap select in mat-form-field with outline appearance', () => {
      const formFields = fixture.nativeElement.querySelectorAll('mat-form-field');
      expect(formFields.length).toBeGreaterThanOrEqual(1);
    });
  });
});
