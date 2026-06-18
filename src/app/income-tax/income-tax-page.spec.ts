import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IncomeTaxPage } from './income-tax-page';

describe('IncomeTaxPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeTaxPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(IncomeTaxPage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title in h1', async () => {
    const fixture = TestBed.createComponent(IncomeTaxPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('personal-income-tax');
  });
});
