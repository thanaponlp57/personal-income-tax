import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService (shell)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('me() returns the user when logged in', () => {
    let result: unknown;
    service.me().subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush({ subject: 'sub-123', username: 'alice', fullName: 'Alice Smith' });

    expect((result as { username: string } | null)?.username).toBe('alice');
    expect(service.currentUser()?.username).toBe('alice');
  });

  it('me() returns null on 401', () => {
    let result: unknown = 'not-set';
    service.me().subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('logout() submits a top-level form POST with the CSRF token', () => {
    // RP-initiated logout must be a real navigation, not an XHR, so logout() builds
    // and submits a form. Stub submit() (jsdom does not implement navigation).
    document.cookie = 'XSRF-TOKEN=tok-123';
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    service.logout();

    const form = document.querySelector<HTMLFormElement>('form[action="/api/v1/auth/logout"]');
    expect(form).toBeTruthy();
    expect(form?.method).toBe('post');
    const csrf = form?.querySelector<HTMLInputElement>('input[name="_csrf"]');
    expect(csrf?.value).toBe('tok-123');
    expect(submit).toHaveBeenCalledOnce();

    // logout() makes no HTTP call — httpMock.verify() in afterEach confirms this.
    form?.remove();
    submit.mockRestore();
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
});
