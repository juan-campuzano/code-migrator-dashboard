import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RepositoryService } from './repository.service';
import {
  IngestionRecord,
  RepositoryMetadata,
  RepositoryLanguage,
  RepositoryFramework,
  RepositoryDependency,
} from '../models/repository.models';

describe('RepositoryService', () => {
  let service: RepositoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RepositoryService],
    });
    service = TestBed.inject(RepositoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('triggerIngestion', () => {
    it('should POST to /api/ingestions and return ingestion ID', () => {
      const source = { type: 'local', path: '/tmp/repo' };
      const mockResponse = { ingestionId: 'ing-123' };

      service.triggerIngestion(source).subscribe((result) => {
        expect(result.ingestionId).toBe('ing-123');
      });

      const req = httpMock.expectOne('/api/ingestions');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ source });
      req.flush(mockResponse);
    });

    it('should handle remote URL source', () => {
      const source = { type: 'github', url: 'https://github.com/owner/repo' };

      service.triggerIngestion(source).subscribe();

      const req = httpMock.expectOne('/api/ingestions');
      expect(req.request.body).toEqual({ source });
      req.flush({ ingestionId: 'ing-456' });
    });
  });

  describe('getIngestionStatus', () => {
    it('should GET ingestion status by ID', () => {
      const mockRecord: IngestionRecord = {
        id: 'ing-123',
        repositoryId: 'repo-1',
        status: 'completed',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
      };

      service.getIngestionStatus('ing-123').subscribe((result) => {
        expect(result).toEqual(mockRecord);
      });

      const req = httpMock.expectOne('/api/ingestions/ing-123');
      expect(req.request.method).toBe('GET');
      req.flush(mockRecord);
    });
  });

  describe('getRepositoryMetadata', () => {
    it('should GET full metadata for a repository', () => {
      const mockMetadata: RepositoryMetadata = {
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          sourceType: 'local',
          sourceIdentifier: '/tmp/repo',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        latestIngestion: {
          id: 'ing-1',
          repositoryId: 'repo-1',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
        },
        languages: [{ language: 'TypeScript', fileCount: 10, proportion: 0.8 }],
        frameworks: [{ name: 'Angular', version: '17.0.0' }],
        dependencies: [{ ecosystem: 'npm', name: 'rxjs', versionConstraint: '^7.0.0', dependencyType: 'production' }],
      };

      service.getRepositoryMetadata('repo-1').subscribe((result) => {
        expect(result).toEqual(mockMetadata);
      });

      const req = httpMock.expectOne('/api/repositories/repo-1/metadata');
      expect(req.request.method).toBe('GET');
      req.flush(mockMetadata);
    });
  });

  describe('getLanguages', () => {
    it('should GET language breakdown for a repository', () => {
      const mockLanguages: RepositoryLanguage[] = [
        { language: 'TypeScript', fileCount: 10, proportion: 0.7 },
        { language: 'JavaScript', fileCount: 3, proportion: 0.2 },
        { language: 'HTML', fileCount: 2, proportion: 0.1 },
      ];

      service.getLanguages('repo-1').subscribe((result) => {
        expect(result).toEqual(mockLanguages);
      });

      const req = httpMock.expectOne('/api/repositories/repo-1/languages');
      expect(req.request.method).toBe('GET');
      req.flush(mockLanguages);
    });
  });

  describe('getFrameworks', () => {
    it('should GET detected frameworks for a repository', () => {
      const mockFrameworks: RepositoryFramework[] = [
        { name: 'Angular', version: '17.0.0' },
        { name: 'Express' },
      ];

      service.getFrameworks('repo-1').subscribe((result) => {
        expect(result).toEqual(mockFrameworks);
      });

      const req = httpMock.expectOne('/api/repositories/repo-1/frameworks');
      expect(req.request.method).toBe('GET');
      req.flush(mockFrameworks);
    });
  });

  describe('getDependencies', () => {
    it('should GET dependencies grouped by ecosystem', () => {
      const mockDeps: RepositoryDependency[] = [
        { ecosystem: 'npm', name: 'rxjs', versionConstraint: '^7.0.0', dependencyType: 'production' },
        { ecosystem: 'npm', name: 'jest', versionConstraint: '^29.0.0', dependencyType: 'development' },
      ];

      service.getDependencies('repo-1').subscribe((result) => {
        expect(result).toEqual(mockDeps);
      });

      const req = httpMock.expectOne('/api/repositories/repo-1/dependencies');
      expect(req.request.method).toBe('GET');
      req.flush(mockDeps);
    });
  });

  describe('updateTokens', () => {
    it('should PUT token configuration', () => {
      const tokens = { provider: 'github', token: 'ghp_abc123' };

      service.updateTokens(tokens).subscribe();

      const req = httpMock.expectOne('/api/settings/tokens');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(tokens);
      req.flush(null);
    });
  });

  describe('getTokens', () => {
    it('should GET configured providers without secrets', () => {
      const mockTokens = { providers: ['github', 'azure_devops'] };

      service.getTokens().subscribe((result) => {
        expect(result).toEqual(mockTokens);
      });

      const req = httpMock.expectOne('/api/settings/tokens');
      expect(req.request.method).toBe('GET');
      req.flush(mockTokens);
    });
  });
});
