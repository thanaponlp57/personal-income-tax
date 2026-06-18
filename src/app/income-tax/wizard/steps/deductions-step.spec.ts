import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TaxpayerProfile } from '../../models/tax.models';
import { TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { provideTaxApiMock } from '../../services/tax-api.service.mock';
import { DeductionsStep } from './deductions-step';

const singleProfile: TaxpayerProfile = {
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  taxId: '1234567890123',
  maritalStatus: 'single',
  spouseHasIncome: false,
};

const setup = async (profile: TaxpayerProfile = singleProfile, salary = 600_000) => {
  TestBed.configureTestingModule({
    imports: [DeductionsStep],
    providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
  });
  const store = TestBed.inject(TaxWizardStore);
  store.saveProfile(profile);
  store.saveIncome({ salary, bonus: 0, otherIncome: 0, withholdingTax: 0 });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(DeductionsStep);
  await fixture.whenStable();
  return { fixture, store, navigate };
};

const query = <T extends HTMLElement>(
  fixture: ComponentFixture<DeductionsStep>,
  selector: string,
) => fixture.nativeElement.querySelector(selector) as T;

const typeInto = async (
  fixture: ComponentFixture<DeductionsStep>,
  id: string,
  value: string,
): Promise<void> => {
  const input = query<HTMLInputElement>(fixture, `#${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

const submitForm = async (fixture: ComponentFixture<DeductionsStep>): Promise<void> => {
  query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
  await fixture.whenStable();
};

const totalText = (fixture: ComponentFixture<DeductionsStep>): string =>
  query(fixture, '#allowTotal').textContent ?? '';

describe('DeductionsStep', () => {
  it('แสดงลดหย่อนอัตโนมัติส่วนตัว และยอดรวมเริ่มต้น 60,000', async () => {
    const { fixture } = await setup();
    expect(query(fixture, '.alert-secondary').textContent).toContain('ส่วนตัว');
    expect(query(fixture, '#autoSpouse')).toBeNull();
    expect(totalText(fixture)).toBe('60,000');
  });

  it('คู่สมรสไม่มีเงินได้ (จากขั้น 1) → แสดงบรรทัดคู่สมรสและรวมเป็น 120,000', async () => {
    const { fixture } = await setup({
      ...singleProfile,
      maritalStatus: 'married',
      spouseHasIncome: false,
    });
    expect(query(fixture, '#autoSpouse').textContent).toContain('คู่สมรสไม่มีเงินได้');
    expect(totalText(fixture)).toBe('120,000');
  });

  it('กรอกประกันสังคม 12,000 → hint แสดงใช้ได้จริง 9,000 และยอดรวมใช้ 9,000', async () => {
    const { fixture, store, navigate } = await setup();
    await typeInto(fixture, 'socialSecurity', '12000');
    const hint = query(fixture, '.hint-cap');
    expect(hint.textContent).toContain('ใช้ได้จริง 9,000 บาท');
    expect(totalText(fixture)).toBe('69,000');
    await submitForm(fixture);
    expect(navigate).toHaveBeenCalledWith(['../review'], expect.anything());
    // store เก็บค่าที่กรอกจริง (entered) — การตัดเพดานเป็นของ service (UX-09)
    expect(store.deductions()?.socialSecurity).toBe(12_000);
    expect(store.computation()?.allowancesTotal).toBe(69_000);
  });

  it('รายการไม่เกินเพดาน → ไม่มี hint', async () => {
    const { fixture } = await setup();
    await typeInto(fixture, 'socialSecurity', '5000');
    expect(query(fixture, '.hint-cap')).toBeNull();
    expect(totalText(fixture)).toBe('65,000');
  });

  it('PVD เพดาน dynamic: ค่าจ้าง 600,000 กรอก 120,000 → ใช้ได้ 90,000 (15%)', async () => {
    const { fixture } = await setup();
    await typeInto(fixture, 'providentFund', '120000');
    expect(query(fixture, '.hint-cap').textContent).toContain('ใช้ได้จริง 90,000 บาท');
    expect(totalText(fixture)).toBe('150,000');
  });

  it('บุตร 2 + บิดามารดา 2 → ลดหย่อนครอบครัว 120,000 (รวม 180,000)', async () => {
    const { fixture } = await setup();
    await typeInto(fixture, 'children', '2');
    await typeInto(fixture, 'parents', '2');
    expect(totalText(fixture)).toBe('180,000');
  });

  it('ค่าติดลบ/ทศนิยมในช่องจำนวนคน → invalid ไปต่อไม่ได้', async () => {
    const { fixture, navigate } = await setup();
    await typeInto(fixture, 'children', '-1');
    await submitForm(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect(query<HTMLInputElement>(fixture, '#children').classList.contains('is-invalid')).toBe(
      true,
    );
  });

  it('กรอกครบกดถัดไป → store ได้ Deductions ครบ + ขั้น 3 mark เสร็จ', async () => {
    const { fixture, store } = await setup();
    await typeInto(fixture, 'children', '1');
    await typeInto(fixture, 'lifeInsurance', '50000');
    await submitForm(fixture);
    expect(store.deductions()).toEqual({
      children: 1,
      parents: 0,
      socialSecurity: 0,
      lifeInsurance: 50_000,
      providentFund: 0,
      homeLoanInterest: 0,
      donation: 0,
    });
    expect(store.completedSteps().has('deductions')).toBe(true);
  });

  it('ย้อนกลับเข้ามาใหม่ → ค่าเดิมถูก patch กลับ', async () => {
    TestBed.configureTestingModule({
      imports: [DeductionsStep],
      providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
    });
    const store = TestBed.inject(TaxWizardStore);
    store.saveProfile(singleProfile);
    store.saveIncome({ salary: 600_000, bonus: 0, otherIncome: 0, withholdingTax: 0 });
    store.saveDeductions({
      children: 2,
      parents: 0,
      socialSecurity: 9_000,
      lifeInsurance: 0,
      providentFund: 0,
      homeLoanInterest: 0,
      donation: 0,
    });
    const fixture = TestBed.createComponent(DeductionsStep);
    await fixture.whenStable();
    expect(query<HTMLInputElement>(fixture, '#children').value).toBe('2');
    expect(query<HTMLInputElement>(fixture, '#socialSecurity').value).toBe('9,000');
  });

  it('กดบันทึกร่าง → store เก็บ deductions แต่ไม่ mark step และไม่ navigate', async () => {
    const { fixture, store, navigate } = await setup();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    buttons.find((b) => b.textContent?.includes('บันทึกร่าง'))!.click();
    await fixture.whenStable();
    expect(store.deductions()).not.toBeNull();
    expect(store.completedSteps().has('deductions')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
