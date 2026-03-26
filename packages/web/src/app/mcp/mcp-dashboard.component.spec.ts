import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';

import { of, throwError, Subject } from 'rxjs';

import { McpDashboardComponent } from './mcp-dashboard.component';
import { McpService } from './services/mcp.service';

describe('McpDashboardComponent', () => {
  let component: McpDashboardComponent;
  let fixture: ComponentFixture<McpDashboardComponent>;
  let mcpService: jasmine.SpyObj<McpService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('McpService', [
      'start',
      'stop',
      'getStatus',
      'sendPrompt',
      'getSystemPrompt',
      'updateSystemPrompt',
    ]);

    // Default return values for ngOnInit calls
    spy.getStatus.and.returnValue(of({ status: 'disconnected', tools: [] }));
    spy.getSystemPrompt.and.returnValue(of({ prompt: 'Default prompt', isDefault: true }));

    await TestBed.configureTestingModule({
      declarations: [McpDashboardComponent],
      imports: [
        FormsModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        RouterTestingModule,
        MatCardModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,
        MatIconModule,
        MatExpansionModule,
      ],
      providers: [{ provide: McpService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(McpDashboardComponent);
    component = fixture.componentInstance;
    mcpService = TestBed.inject(McpService) as jasmine.SpyObj<McpService>;
    fixture.detectChanges();
  });

  // 1. Component should create successfully
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // 2. Should display "Offline" status when disconnected (Validates: Requirements 5.1)
  it('should display "Offline" status when disconnected', () => {
    component.status = 'disconnected';
    fixture.detectChanges();

    const statusChip = fixture.nativeElement.querySelector('.status-chip') as HTMLElement;
    expect(statusChip).toBeTruthy();
    expect(statusChip.textContent).toContain('Offline');
    expect(statusChip.classList).toContain('disconnected');
  });

  // 3. Should display "Online" status when connected (Validates: Requirements 5.1)
  it('should display "Online" status when connected', () => {
    component.status = 'connected';
    fixture.detectChanges();

    const statusChip = fixture.nativeElement.querySelector('.status-chip') as HTMLElement;
    expect(statusChip).toBeTruthy();
    expect(statusChip.textContent).toContain('Online');
    expect(statusChip.classList).toContain('connected');
  });

  // 4. Should show Start button when disconnected (Validates: Requirements 5.2)
  it('should show Start button when disconnected', () => {
    component.status = 'disconnected';
    fixture.detectChanges();

    const startBtn = fixture.nativeElement.querySelector('.btn-start') as HTMLButtonElement;
    const stopBtn = fixture.nativeElement.querySelector('.btn-stop') as HTMLButtonElement;
    expect(startBtn).toBeTruthy();
    expect(stopBtn).toBeFalsy();
  });

  // 5. Should show Stop button when connected (Validates: Requirements 5.3)
  it('should show Stop button when connected', () => {
    component.status = 'connected';
    fixture.detectChanges();

    const stopBtn = fixture.nativeElement.querySelector('.btn-stop') as HTMLButtonElement;
    const startBtn = fixture.nativeElement.querySelector('.btn-start') as HTMLButtonElement;
    expect(stopBtn).toBeTruthy();
    expect(startBtn).toBeFalsy();
  });

  // 6. Should disable Send button when disconnected (Validates: Requirements 5.8)
  it('should disable Send button when disconnected', () => {
    component.status = 'disconnected';
    component.promptText = 'Some prompt';
    fixture.detectChanges();

    const sendBtn = fixture.nativeElement.querySelector('.btn-send') as HTMLButtonElement;
    expect(sendBtn).toBeTruthy();
    expect(sendBtn.disabled).toBeTrue();
  });

  // 7. Should disable Send button when prompt is empty (Validates: Requirements 5.8)
  it('should disable Send button when prompt is empty', () => {
    component.status = 'connected';
    component.promptText = '';
    fixture.detectChanges();

    const sendBtn = fixture.nativeElement.querySelector('.btn-send') as HTMLButtonElement;
    expect(sendBtn).toBeTruthy();
    expect(sendBtn.disabled).toBeTrue();
  });

  // 8. Should show loading spinner during prompt execution (Validates: Requirements 5.8)
  it('should show loading spinner during prompt execution', () => {
    component.status = 'connected';
    component.loading = true;
    fixture.detectChanges();

    const progressBar = fixture.nativeElement.querySelector('mat-progress-bar') as HTMLElement;
    expect(progressBar).toBeTruthy();

    const sendBtn = fixture.nativeElement.querySelector('.btn-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBeTrue();
  });

  // 9. Should display error message on API failure (Validates: Requirements 5.9)
  it('should display error message on API failure', () => {
    component.error = 'Failed to execute prompt.';
    fixture.detectChanges();

    const errorBar = fixture.nativeElement.querySelector('.error-bar') as HTMLElement;
    expect(errorBar).toBeTruthy();
    expect(errorBar.textContent).toContain('Failed to execute prompt.');
  });

  // 10. Should display response text after successful prompt (Validates: Requirements 5.2, 5.3)
  it('should display response text after successful prompt', () => {
    component.responseText = 'Here is the Claude response.';
    fixture.detectChanges();

    const responseBody = fixture.nativeElement.querySelector('.response-body') as HTMLElement;
    expect(responseBody).toBeTruthy();
    expect(responseBody.textContent).toContain('Here is the Claude response.');
  });
});
