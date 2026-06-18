import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    // App calls auth.me() on startup — answer it so the test has no open request.
    httpMock.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the income-tax nav link', async () => {
    const fixture = TestBed.createComponent(App);
    httpMock.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a.nav-link[routerLink]')?.textContent?.trim()).toBe('Income Tax');
  });

  it('shows the user name and a logout button when logged in', async () => {
    const fixture = TestBed.createComponent(App);
    httpMock
      .expectOne('/api/v1/auth/me')
      .flush({ subject: 'sub-123', username: 'alice', fullName: 'Alice Smith' });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.navbar-text')?.textContent?.trim()).toBe('Alice Smith');
    expect(compiled.querySelector('button.btn')?.textContent?.trim()).toBe('Logout');
  });
});
