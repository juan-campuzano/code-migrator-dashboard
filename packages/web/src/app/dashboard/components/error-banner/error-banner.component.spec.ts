import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorBannerComponent, ScanError } from './error-banner.component';

describe('ErrorBannerComponent', () => {
  let component: ErrorBannerComponent;
  let fixture: ComponentFixture<ErrorBannerComponent>;

  const sampleErrors: ScanError[] = [
    { file: 'package.json', message: 'Invalid JSON syntax' },
    { file: 'pom.xml', message: 'Malformed XML' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ErrorBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorBannerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('empty state', () => {
    it('should not render when errors is null', () => {
      component.errors = null;
      fixture.detectChanges();

      expect(component.hasErrors).toBeFalse();
      const banner = fixture.nativeElement.querySelector('.error-banner');
      expect(banner).toBeFalsy();
    });

    it('should not render when errors is empty array', () => {
      component.errors = [];
      fixture.detectChanges();

      expect(component.hasErrors).toBeFalse();
      const banner = fixture.nativeElement.querySelector('.error-banner');
      expect(banner).toBeFalsy();
    });
  });

  describe('error display', () => {
    it('should render banner when errors are present', () => {
      component.errors = sampleErrors;
      fixture.detectChanges();

      expect(component.hasErrors).toBeTrue();
      const banner = fixture.nativeElement.querySelector('.error-banner');
      expect(banner).toBeTruthy();
    });

    it('should have role="alert" for accessibility', () => {
      component.errors = sampleErrors;
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector('.error-banner');
      expect(banner.getAttribute('role')).toBe('alert');
    });

    it('should display a title', () => {
      component.errors = sampleErrors;
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.error-banner-title');
      expect(title).toBeTruthy();
      expect(title.textContent).toContain('Scan Errors');
    });

    it('should render all error items', () => {
      component.errors = sampleErrors;
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.error-item');
      expect(items.length).toBe(2);
    });

    it('should display file name and message for each error', () => {
      component.errors = sampleErrors;
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.error-item');
      expect(items[0].querySelector('.error-file').textContent).toContain('package.json');
      expect(items[0].querySelector('.error-message').textContent).toContain('Invalid JSON syntax');
      expect(items[1].querySelector('.error-file').textContent).toContain('pom.xml');
      expect(items[1].querySelector('.error-message').textContent).toContain('Malformed XML');
    });

    it('should handle a single error', () => {
      component.errors = [{ file: 'Cargo.toml', message: 'Parse error' }];
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.error-item');
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain('Cargo.toml');
      expect(items[0].textContent).toContain('Parse error');
    });
  });
});
