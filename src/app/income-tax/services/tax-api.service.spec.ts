import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TaxApiService, DraftPayload } from './tax-api.service';
import { TaxpayerProfile, EmploymentIncome, Deductions } from '../models/tax.models';

describe('TaxApiService', () => {
  let service: TaxApiService;
  let httpMock: HttpTestingController;

  const goldenProfile: TaxpayerProfile = {
    firstName: 'Golden', lastName: 'Case', taxId: '1234567890123',
    maritalStatus: 'single', spouseHasIncome: false,
  };
  const goldenIncome: EmploymentIncome = {
    salary: 600_000, bonus: 0, otherIncome: 0, withholdingTax: 0,
  };
  const goldenDeductions: Deductions = {
    children: 0, parents: 0, socialSecurity: 0, lifeInsurance: 0,
    providentFund: 0, homeLoanInterest: 0, donation: 0,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaxApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TaxApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('calculate() ส่ง request shape ถูกต้อง (maritalStatus uppercase) และคืน TaxComputation', () => {
    let result: any;
    service.calculate(goldenProfile, goldenIncome, goldenDeductions)
      .subscribe(r => result = r);

    const req = httpMock.expectOne('http://localhost:8080/api/v1/tax/calculate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      taxpayer: { maritalStatus: 'SINGLE', spouseHasIncome: false },
      income: { salary: 600_000, bonus: 0, otherIncome: 0, withholdingTax: 0 },
      deductions: { children: 0, parents: 0, socialSecurity: 0, lifeInsurance: 0,
                    providentFund: 0, homeLoanInterest: 0, donation: 0 },
    });

    req.flush({ totalIncome: 600000, expense: 100000, allowanceItems: [],
                allowancesTotal: 60000, netIncome: 440000, bracketPortions: [],
                tax: 21500, balance: 21500 });
    expect(result.tax).toBe(21_500);
  });

  it('submitFiling() POST ไป /api/v1/filings คืน FilingResult', () => {
    let result: any;
    service.submitFiling(goldenProfile, goldenIncome, goldenDeductions)
      .subscribe(r => result = r);

    const req = httpMock.expectOne('http://localhost:8080/api/v1/filings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.taxpayer.maritalStatus).toBe('SINGLE');
    req.flush({ id: 'uuid-001', submittedAt: '2026-06-14T12:00:00Z',
                computation: { tax: 21500, balance: 21500 } });
    expect(result.id).toBe('uuid-001');
    expect(result.computation.tax).toBe(21500);
  });

  it('saveDraft() PUT ไป /api/v1/drafts/me', () => {
    const payload: DraftPayload = {
      profile: null, income: null, deductions: null, completedSteps: [],
    };
    service.saveDraft(payload).subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/v1/drafts/me');
    expect(req.request.method).toBe('PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('getDraft() คืน null เมื่อ BE ตอบ 404', () => {
    let result: any = 'not-set';
    service.getDraft().subscribe(r => result = r);
    const req = httpMock.expectOne('http://localhost:8080/api/v1/drafts/me');
    req.flush({ status: 404 }, { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();
  });

  it('deleteDraft() DELETE ไป /api/v1/drafts/me', () => {
    service.deleteDraft().subscribe();
    const req = httpMock.expectOne('http://localhost:8080/api/v1/drafts/me');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
