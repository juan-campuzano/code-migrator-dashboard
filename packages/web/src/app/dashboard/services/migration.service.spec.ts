import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MigrationService } from './migration.service';
import { MigrationStatus } from '../models/repository.models';

describe('MigrationService', () => {
  let service: MigrationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MigrationService],
    });
    service = TestBed.inject(MigrationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('triggerMigration', () => {
    it('should POST to /api/migrations with correct body', () => {
      const mockResponse = { migrationId: 'mig-1', status: 'queued' };

      service
        .triggerMigration('repo-1', 'framework_upgrade', { targetVersion: '2.0' })
        .subscribe((result) => {
          expect(result).toEqual(mockResponse);
        });

      const req = httpMock.expectOne('/api/migrations');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        repositoryId: 'repo-1',
        migrationType: 'framework_upgrade',
        parameters: { targetVersion: '2.0' },
      });
      req.flush(mockResponse);
    });

    it('should POST without parameters when not provided', () => {
      service.triggerMigration('repo-2', 'dependency_migration').subscribe();

      const req = httpMock.expectOne('/api/migrations');
      expect(req.request.body).toEqual({
        repositoryId: 'repo-2',
        migrationType: 'dependency_migration',
        parameters: undefined,
      });
      req.flush({ migrationId: 'mig-2', status: 'queued' });
    });
  });

  describe('getMigrationStatus', () => {
    it('should GET migration status by ID', () => {
      const mockStatus: MigrationStatus = {
        migrationId: 'mig-1',
        repositoryId: 'repo-1',
        migrationType: 'framework_upgrade',
        status: 'running',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:01:00Z',
      };

      service.getMigrationStatus('mig-1').subscribe((result) => {
        expect(result).toEqual(mockStatus);
      });

      const req = httpMock.expectOne('/api/migrations/mig-1');
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);
    });

    it('should return completed status with result', () => {
      const mockStatus: MigrationStatus = {
        migrationId: 'mig-2',
        repositoryId: 'repo-1',
        migrationType: 'dependency_migration',
        status: 'completed',
        result: 'Migrated 5 dependencies',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:02:00Z',
      };

      service.getMigrationStatus('mig-2').subscribe((result) => {
        expect(result.status).toBe('completed');
        expect(result.result).toBe('Migrated 5 dependencies');
      });

      const req = httpMock.expectOne('/api/migrations/mig-2');
      req.flush(mockStatus);
    });

    it('should return failed status with error details', () => {
      const mockStatus: MigrationStatus = {
        migrationId: 'mig-3',
        repositoryId: 'repo-1',
        migrationType: 'framework_upgrade',
        status: 'failed',
        errorDetails: 'Incompatible version',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:02:00Z',
      };

      service.getMigrationStatus('mig-3').subscribe((result) => {
        expect(result.status).toBe('failed');
        expect(result.errorDetails).toBe('Incompatible version');
      });

      const req = httpMock.expectOne('/api/migrations/mig-3');
      req.flush(mockStatus);
    });
  });
});
