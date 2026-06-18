import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Deductions, TaxpayerProfile } from '../../models/tax.models';
import { TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { provideTaxApiMock } from '../../services/tax-api.service.mock';
import { ResultStep } from './result-step';

const singleProfile: TaxpayerProfile = {
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  taxId: '1234567890123',
  maritalStatus: 'single',
  spouseHasIncome: false,
};

const noDeductions: Deductions = {
  children: 0,
  parents: 0,
  socialSecurity: 0,
  lifeInsurance: 0,
  providentFund: 0,
  homeLoanInterest: 0,
  donation: 0,
};

/** golden case ภาษี 21,500 — withholding เป็นตัวกำหนดทิศทางผลลัพธ์ */
const setup = async (withholdingTax: number) => {
  TestBed.configureTestingModule({
    imports: [ResultStep],
    providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
  });
  const store = TestBed.inject(TaxWizardStore);
  store.saveProfile(singleProfile);
  store.saveIncome({ salary: 600_000, bonus: 0, otherIncome: 0, withholdingTax });
  store.saveDeductions(noDeductions);
  store.confirmReview();
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ResultStep);
  await fixture.whenStable();
  return { fixture, store, navigate };
};

const card = (fixture: ComponentFixture<ResultStep>): HTMLElement =>
  fixture.nativeElement.querySelector('#resultCard') as HTMLElement;

const clickRestart = async (fixture: ComponentFixture<ResultStep>): Promise<void> => {
  const buttons = Array.from(
    fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
  );
  buttons.find((b) => b.textContent?.includes('เริ่มกรอกใหม่'))!.click();
  await fixture.whenStable();
};

describe('ResultStep', () => {
  it('หัก ณ ที่จ่าย 10,000 → "มีภาษีต้องชำระเพิ่ม 11,500 บาท" (การ์ดแดง)', async () => {
    const { fixture } = await setup(10_000);
    expect(card(fixture).classList.contains('alert-danger')).toBe(true);
    expect(card(fixture).textContent).toContain('มีภาษีต้องชำระเพิ่ม');
    expect(card(fixture).textContent).toContain('11,500 บาท');
  });

  it('หัก ณ ที่จ่าย 30,000 → "มีสิทธิขอคืนภาษี 8,500 บาท" (การ์ดเขียว)', async () => {
    const { fixture } = await setup(30_000);
    expect(card(fixture).classList.contains('alert-success')).toBe(true);
    expect(card(fixture).textContent).toContain('มีสิทธิขอคืนภาษี');
    expect(card(fixture).textContent).toContain('8,500 บาท');
  });

  it('หัก ณ ที่จ่ายเท่าภาษีพอดี → "ไม่มีภาษีต้องชำระเพิ่มหรือขอคืน"', async () => {
    const { fixture } = await setup(21_500);
    expect(card(fixture).classList.contains('alert-secondary')).toBe(true);
    expect(card(fixture).textContent).toContain('ไม่มีภาษีต้องชำระเพิ่มหรือขอคืน');
  });

  it('แสดงบรรทัดที่มาของตัวเลขและ disclaimer', async () => {
    const { fixture } = await setup(10_000);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ภาษีที่คำนวณได้ 21,500 บาท');
    expect(text).toContain('หัก ณ ที่จ่าย 10,000 บาท');
    expect(text).toContain('เครื่องมือสาธิตสำหรับ portfolio เท่านั้น');
  });

  it('เริ่มกรอกใหม่: ยืนยันแล้ว → reset + กลับ taxpayer แบบ relative และ review ถูกล็อก', async () => {
    const { fixture, store, navigate } = await setup(10_000);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await clickRestart(fixture);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(store.profile()).toBeNull();
    expect(store.computation()).toBeNull();
    expect(store.canAccess('review')).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['../taxpayer'], expect.anything());
    confirmSpy.mockRestore();
  });

  it('เริ่มกรอกใหม่: กดยกเลิก → ข้อมูลอยู่ครบ ไม่ navigate', async () => {
    const { fixture, store, navigate } = await setup(10_000);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await clickRestart(fixture);
    expect(store.profile()).not.toBeNull();
    expect(store.computation()?.tax).toBe(21_500);
    expect(navigate).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('เริ่มกรอกใหม่: ยืนยันแล้ว → clearDraft ถูกเรียกครั้งเดียว', async () => {
    const { fixture, store } = await setup(10_000);
    const clearDraftSpy = vi.spyOn(store, 'clearDraft').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await clickRestart(fixture);
    expect(clearDraftSpy).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
    clearDraftSpy.mockRestore();
  });

  it('เริ่มกรอกใหม่: กดยกเลิก → clearDraft ไม่ถูกเรียก', async () => {
    const { fixture, store } = await setup(10_000);
    const clearDraftSpy = vi.spyOn(store, 'clearDraft').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await clickRestart(fixture);
    expect(clearDraftSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    clearDraftSpy.mockRestore();
  });

  it('ปุ่มพิมพ์สรุป → เรียก window.print และปุ่มทั้งหมดถูกซ่อนตอนพิมพ์ (d-print-none)', async () => {
    const { fixture } = await setup(10_000);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    buttons.find((b) => b.textContent?.includes('พิมพ์สรุป'))!.click();
    expect(printSpy).toHaveBeenCalledOnce();
    for (const button of buttons) {
      expect(button.closest('.d-print-none')).not.toBeNull();
    }
    printSpy.mockRestore();
  });
});
