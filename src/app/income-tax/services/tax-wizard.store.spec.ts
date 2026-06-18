import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Deductions, EmploymentIncome, TaxpayerProfile } from '../models/tax.models';
import { TaxCalculatorService } from './tax-calculator.service';
import { TaxWizardStore } from './tax-wizard.store';
import { TaxApiService, DraftPayload } from './tax-api.service';
import { provideTaxApiMock } from './tax-api.service.mock';

const profile: TaxpayerProfile = {
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  taxId: '1234567890123',
  maritalStatus: 'single',
  spouseHasIncome: false,
};

const income: EmploymentIncome = { salary: 600_000, bonus: 0, otherIncome: 0, withholdingTax: 0 };

const deductions: Deductions = {
  children: 0,
  parents: 0,
  socialSecurity: 0,
  lifeInsurance: 0,
  providentFund: 0,
  homeLoanInterest: 0,
  donation: 0,
};

const createStore = (): TaxWizardStore => {
  TestBed.configureTestingModule({
    providers: [TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
  });
  return TestBed.inject(TaxWizardStore);
};

describe('TaxWizardStore', () => {
  describe('canAccess', () => {
    it('เริ่มต้น: เข้าได้เฉพาะขั้นแรก ขั้นอื่นล็อกหมด', () => {
      const store = createStore();
      expect(store.canAccess('taxpayer')).toBe(true);
      expect(store.canAccess('income')).toBe(false);
      expect(store.canAccess('deductions')).toBe(false);
      expect(store.canAccess('review')).toBe(false);
      expect(store.canAccess('result')).toBe(false);
    });

    it('saveProfile ปลดล็อกขั้นถัดไปขั้นเดียว — ข้ามขั้นไม่ได้', () => {
      const store = createStore();
      store.saveProfile(profile);
      expect(store.canAccess('income')).toBe(true);
      expect(store.canAccess('deductions')).toBe(false);
      expect(store.canAccess('review')).toBe(false);
    });

    it('saveIncome แล้ว deductions เข้าได้ และขั้นก่อนหน้ายังย้อนกลับได้', () => {
      const store = createStore();
      store.saveProfile(profile);
      store.saveIncome(income);
      expect(store.canAccess('deductions')).toBe(true);
      expect(store.canAccess('taxpayer')).toBe(true);
      expect(store.canAccess('income')).toBe(true);
      expect(store.canAccess('review')).toBe(false);
    });

    it('ครบ 3 ขั้นแรก → review เข้าได้ แต่ result ยังล็อก (รอยืนยันขั้นตรวจสอบ)', () => {
      const store = createStore();
      store.saveProfile(profile);
      store.saveIncome(income);
      store.saveDeductions(deductions);
      expect(store.canAccess('review')).toBe(true);
      expect(store.canAccess('result')).toBe(false);
    });
  });

  describe('computation', () => {
    it('เป็น null จนกว่าข้อมูลจะครบทั้ง 3 ส่วน', () => {
      const store = createStore();
      expect(store.computation()).toBeNull();
      store.saveProfile(profile);
      store.saveIncome(income);
      expect(store.computation()).toBeNull();
    });

    it('ข้อมูลครบ → คำนวณ golden case ได้ภาษี 21,500', () => {
      const store = createStore();
      store.saveProfile(profile);
      store.saveIncome(income);
      store.saveDeductions(deductions);
      expect(store.computation()?.tax).toBe(21_500);
    });
  });

  it('reset() ล้างข้อมูลทุกส่วนและล็อกทุกขั้นกลับเหมือนเริ่มใหม่', () => {
    const store = createStore();
    store.saveProfile(profile);
    store.saveIncome(income);
    store.saveDeductions(deductions);
    store.reset();
    expect(store.profile()).toBeNull();
    expect(store.income()).toBeNull();
    expect(store.deductions()).toBeNull();
    expect(store.computation()).toBeNull();
    expect(store.canAccess('taxpayer')).toBe(true);
    expect(store.canAccess('income')).toBe(false);
    expect(store.canAccess('review')).toBe(false);
  });
});

describe('TaxWizardStore — draft integration', () => {
  let store: TaxWizardStore;
  let mockApi: { getDraft: any; saveDraft: any; deleteDraft: any };

  const savedProfile: TaxpayerProfile = {
    firstName: 'Alice', lastName: 'Smith', taxId: '1234567890123',
    maritalStatus: 'single', spouseHasIncome: false,
  };

  beforeEach(() => {
    mockApi = {
      getDraft: vi.fn(),
      saveDraft: vi.fn(),
      deleteDraft: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        TaxWizardStore,
        TaxCalculatorService,
        { provide: TaxApiService, useValue: mockApi },
      ],
    });
    store = TestBed.inject(TaxWizardStore);
  });

  it('loadDraft() restore profile และ completedSteps จาก BE', () => {
    const draft: DraftPayload = {
      profile: savedProfile, income: null,
      deductions: null, completedSteps: ['taxpayer'],
    };
    mockApi.getDraft.mockReturnValue(of(draft));

    store.loadDraft().subscribe();

    expect(store.profile()).toEqual(savedProfile);
    expect(store.completedSteps().has('taxpayer')).toBe(true);
  });

  it('loadDraft() เป็น no-op เมื่อ getDraft คืน null', () => {
    mockApi.getDraft.mockReturnValue(of(null));
    store.loadDraft().subscribe();
    expect(store.profile()).toBeNull();
  });

  it('saveProfile() (กดถัดไป) ไม่เรียก api.saveDraft อีก แต่ยัง mark step', () => {
    store.saveProfile(savedProfile);
    expect(mockApi.saveDraft).not.toHaveBeenCalled();
    expect(store.completedSteps().has('taxpayer')).toBe(true);
  });

  it('draftProfile() (บันทึกร่าง) set profile + เรียก api.saveDraft แต่ไม่ mark step', () => {
    mockApi.saveDraft.mockReturnValue(of(undefined));
    store.draftProfile(savedProfile);
    expect(store.profile()).toEqual(savedProfile);
    expect(mockApi.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ profile: savedProfile }),
    );
    expect(store.completedSteps().has('taxpayer')).toBe(false);
    expect(store.draftSaveState()).toBe('saved');
  });

  it('draftSaveState เป็น "error" เมื่อ api.saveDraft ล้มเหลว', () => {
    mockApi.saveDraft.mockReturnValue(throwError(() => new Error('boom')));
    store.draftDeductions({
      children: 0, parents: 0, socialSecurity: 0, lifeInsurance: 0,
      providentFund: 0, homeLoanInterest: 0, donation: 0,
    });
    expect(store.draftSaveState()).toBe('error');
  });
});
