import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AuthService, AuthUser } from '../../../auth/auth.service';
import { routes } from '../../../app.routes';
import { TaxpayerProfile } from '../../models/tax.models';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { provideTaxApiMock } from '../../services/tax-api.service.mock';

const mockUser: AuthUser = { subject: 'test', username: 'alice', fullName: 'Alice' };
const mockAuthService = {
  me: () => of(mockUser),
  currentUser: signal<AuthUser | null>(mockUser),
  login: () => {},
};

const profile: TaxpayerProfile = {
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  taxId: '1234567890123',
  maritalStatus: 'single',
  spouseHasIncome: false,
};

/**
 * Mount routes ของ remote ใต้ prefix `income-tax` เหมือนตอน embedded ใน shell —
 * ถ้า guard คืน UrlTree แบบ absolute `/wizard/...` จะไม่ตรง route ใดในผังนี้เลย
 * จึงพิสูจน์ได้ว่า redirect เป็น relative จริง (R6)
 */
const setup = (): void => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'income-tax', children: routes }]),
      { provide: AuthService, useValue: mockAuthService },
      // loadDraftGuard + store auto-save เรียก TaxApiService → mock กัน HTTP จริงใน test
      provideTaxApiMock(),
    ],
  });
};

const currentUrl = (): string => TestBed.inject(Router).url;

describe('canActivateStep', () => {
  it('ขั้นแรกเข้าได้เสมอ', async () => {
    setup();
    await RouterTestingHarness.create('/income-tax/wizard/taxpayer');
    expect(currentUrl()).toBe('/income-tax/wizard/taxpayer');
  });

  it('ขั้นที่ยังไม่ปลดล็อก → redirect กลับขั้นแรก โดยคง prefix /income-tax ไว้', async () => {
    setup();
    await RouterTestingHarness.create('/income-tax/wizard/review');
    expect(currentUrl()).toBe('/income-tax/wizard/taxpayer');
  });

  it('ขั้นที่ปลดล็อกแล้ว → เข้าได้', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/income-tax/wizard/taxpayer');
    harness.routeDebugElement!.injector.get(TaxWizardStore).saveProfile(profile);
    await harness.navigateByUrl('/income-tax/wizard/income');
    expect(currentUrl()).toBe('/income-tax/wizard/income');
  });

  it('redirect ไปขั้นล่าสุดที่เข้าได้ ไม่ใช่ขั้นแรกเสมอไป', async () => {
    setup();
    const harness = await RouterTestingHarness.create('/income-tax/wizard/taxpayer');
    harness.routeDebugElement!.injector.get(TaxWizardStore).saveProfile(profile);
    await harness.navigateByUrl('/income-tax/wizard/review');
    expect(currentUrl()).toBe('/income-tax/wizard/income');
  });

  it('เข้า wizard เปล่า ๆ → redirect ไปขั้นแรก', async () => {
    setup();
    await RouterTestingHarness.create('/income-tax/wizard');
    expect(currentUrl()).toBe('/income-tax/wizard/taxpayer');
  });

  it('โหมด standalone (routes ที่ root) → redirect แบบ relative ทำงานเหมือนกัน', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: mockAuthService },
        provideTaxApiMock(),
      ],
    });
    await RouterTestingHarness.create('/wizard/review');
    expect(currentUrl()).toBe('/wizard/taxpayer');
  });
});
