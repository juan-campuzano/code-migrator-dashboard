import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';
import { IngestionStatusComponent } from './ingestion-status.component';
import { RepositoryService } from '../../services/repository.service';
import { IngestionRecord } from '../../models/repository.models';
import { of, throwError } from 'rxjs';

describe('IngestionStatusComponent', () => {
  let component: IngestionStatusComponent;
  let fixture: ComponentFixture<IngestionStatusComponent>;
  let repositoryService: jasmine.SpyObj<RepositoryService>;

  const completedRecord: IngestionRecord = {
    id: 'ing-1',
    repositoryId: 'repo-1',
    status: 'completed',
    startedAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:01:00Z',
  };

  const inProgressRecord: IngestionRecord = {
    id: 'ing-1',
    repositoryId: 'repo-1',
    status: 'in_progress',
    startedAt: '2024-01-01T00:00:00Z',
  };

  const failedRecord: IngestionRecord = {
    id: 'ing-1',
    repositoryId: 'repo-1',
    status: 'failed',
    startedAt: '2024-01-01T00:00:00Z',
    errorDetails: 'Repository not found',
  };

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('RepositoryService', ['getIngestionStatus']);

    await TestBed.configureTestingModule({
      declarations: [IngestionStatusComponent],
      imports: [HttpClientTestingModule, MatIconModule],
      providers: [{ provide: RepositoryService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(IngestionStatusComponent);
    component = fixture.componentInstance;
    repositoryService = TestBed.inject(RepositoryService) as jasmine.SpyObj<RepositoryService>;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not poll when ingestionId is null', () => {
    component.ingestionId = null;
    component.ngOnInit();
    expect(repositoryService.getIngestionStatus).not.toHaveBeenCalled();
  });

  it('should fetch status immediately when ingestionId is set', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(inProgressRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledWith('ing-1');
    expect(component.currentStatus).toBe('in_progress');
  });

  it('should display completed status and timestamp', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(completedRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.currentStatus).toBe('completed');
    expect(component.lastCompletedAt).toBe('2024-01-01T00:01:00Z');
  });

  it('should emit ingestionCompleted when status is completed', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(completedRecord));
    spyOn(component.ingestionCompleted, 'emit');
    component.ingestionId = 'ing-1';
    component.ngOnInit();

    expect(component.ingestionCompleted.emit).toHaveBeenCalledWith(completedRecord);
  });

  it('should show error details when status is failed', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(failedRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.currentStatus).toBe('failed');
    expect(component.errorMessage).toBe('Repository not found');
  });

  it('should show default error message when failed without errorDetails', () => {
    const failedNoDetails: IngestionRecord = { ...failedRecord, errorDetails: undefined };
    repositoryService.getIngestionStatus.and.returnValue(of(failedNoDetails));
    component.ingestionId = 'ing-1';
    component.ngOnInit();

    expect(component.errorMessage).toBe('Ingestion failed.');
  });

  it('should retain previous data on fetch error', () => {
    // First call succeeds with in_progress
    repositoryService.getIngestionStatus.and.returnValue(of(inProgressRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    expect(component.currentStatus).toBe('in_progress');

    // Second call fails
    repositoryService.getIngestionStatus.and.returnValue(throwError(() => new Error('Network error')));
    (component as any).fetchStatus();

    expect(component.currentStatus).toBe('in_progress');
    expect(component.errorMessage).toBe('Failed to fetch ingestion status.');
  });

  it('should stop polling when status is completed', fakeAsync(() => {
    repositoryService.getIngestionStatus.and.returnValue(of(completedRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();

    // After completion, polling should have stopped — only the initial call
    tick(4000);
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledTimes(1);
  }));

  it('should stop polling when status is failed', fakeAsync(() => {
    repositoryService.getIngestionStatus.and.returnValue(of(failedRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();

    tick(4000);
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledTimes(1);
  }));

  it('should poll while in_progress', fakeAsync(() => {
    repositoryService.getIngestionStatus.and.returnValue(of(inProgressRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();

    // Initial call
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledTimes(1);

    // After 2 seconds, should poll again
    tick(2000);
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledTimes(2);

    // After another 2 seconds
    tick(2000);
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledTimes(3);

    // Clean up
    component.ngOnDestroy();
    tick(2000);
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledTimes(3);
  }));

  it('should restart polling when ingestionId changes', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(inProgressRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledWith('ing-1');

    component.ingestionId = 'ing-2';
    component.ngOnChanges();
    expect(repositoryService.getIngestionStatus).toHaveBeenCalledWith('ing-2');
  });

  it('should show spinner when in_progress', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(inProgressRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });

  it('should not show spinner when completed', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(completedRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.spinner');
    expect(spinner).toBeFalsy();
  });

  it('should display error message in template when failed', () => {
    repositoryService.getIngestionStatus.and.returnValue(of(failedRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.error-message');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Repository not found');
  });

  it('should not render when ingestionId is null', () => {
    component.ingestionId = null;
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.ingestion-status');
    expect(container).toBeFalsy();
  });

  it('should clean up interval on destroy', fakeAsync(() => {
    repositoryService.getIngestionStatus.and.returnValue(of(inProgressRecord));
    component.ingestionId = 'ing-1';
    component.ngOnInit();

    component.ngOnDestroy();
    repositoryService.getIngestionStatus.calls.reset();
    tick(4000);
    expect(repositoryService.getIngestionStatus).not.toHaveBeenCalled();
  }));
});
