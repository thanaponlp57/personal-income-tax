import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
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

  it('me() คืน user เมื่อ logged in', () => {
    let result: any;
    service.me().subscribe(r => result = r);

    const req = httpMock.expectOne('http://localhost:8080/api/v1/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush({ subject: 'sub-123', username: 'alice', fullName: 'Alice Smith' });
    expect(result?.username).toBe('alice');
    expect(service.currentUser()?.username).toBe('alice');
  });

  it('me() คืน null เมื่อ 401', () => {
    let result: any = 'not-set';
    service.me().subscribe(r => result = r);

    const req = httpMock.expectOne('http://localhost:8080/api/v1/auth/me');
    req.flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBeNull();
    expect(service.currentUser()).toBeNull();
  });
});
