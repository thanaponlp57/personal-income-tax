import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Deductions, TaxpayerProfile } from '../../models/tax.models';
import { TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { provideTaxApiMock } from '../../services/tax-api.service.mock';
import { ReviewStep } from './review-step';

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

const setup = async (deductions: Partial<Deductions> = {}, withholdingTax = 0) => {
  TestBed.configureTestingModule({
    imports: [ReviewStep],
    providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
  });
  const store = TestBed.inject(TaxWizardStore);
  store.saveProfile(singleProfile);
  store.saveIncome({ salary: 600_000, bonus: 0, otherIncome: 0, withholdingTax });
  store.saveDeductions({ ...noDeductions, ...deductions });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ReviewStep);
  await fixture.whenStable();
  return { fixture, store, navigate };
};

const query = <T extends HTMLElement>(fixture: ComponentFixture<ReviewStep>, selector: string) =>
  fixture.nativeElement.querySelector(selector) as T;

// Angular ตัด whitespace ระหว่าง element ใน template → join cell ด้วยช่องว่างเอง
const calcRows = (fixture: ComponentFixture<ReviewStep>): string[] =>
  Array.from(query(fixture, '#calcTable').querySelectorAll('tr')).map((row) =>
    Array.from((row as HTMLTableRowElement).cells)
      .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .join(' '),
  );

describe('ReviewStep', () => {
  it('golden case (600,000 โสด) → แสดงสุทธิ 440,000 ภาษี 21,500', async () => {
    const { fixture } = await setup();
    const rows = calcRows(fixture);
    expect(rows).toContain('เงินได้สุทธิ 440,000');
    expect(rows).toContain('ภาษีที่คำนวณได้ 21,500');
    expect(rows).toContain('เงินได้พึงประเมิน (มาตรา 40(1)) 600,000');
  });

  it('แสดง 3 sections พร้อมปุ่มแก้ไข และข้อมูลผู้มีเงินได้ครบ', async () => {
    const { fixture } = await setup();
    const editLinks = Array.from(
      fixture.nativeElement.querySelectorAll('a.btn') as NodeListOf<HTMLAnchorElement>,
    );
    expect(editLinks).toHaveLength(3);
    expect(editLinks.every((a) => a.textContent?.trim() === 'แก้ไข')).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('สมชาย ใจดี');
    expect(text).toContain('1234567890123');
    expect(text).toContain('โสด');
  });

  it('ประกันสังคม 12,000 → แถวแสดง 9,000 พร้อม "จำกัดเพดาน — จากที่กรอก 12,000" (UX-09)', async () => {
    const { fixture } = await setup({ socialSecurity: 12_000 });
    const row = calcRows(fixture).find((r) => r.includes('ประกันสังคม'));
    expect(row).toContain('-9,000');
    expect(row).toContain('จำกัดเพดาน — จากที่กรอก 12,000');
  });

  it('รายการไม่โดนตัดเพดาน → ไม่มี annotation', async () => {
    const { fixture } = await setup({ lifeInsurance: 50_000 });
    const row = calcRows(fixture).find((r) => r.includes('เบี้ยประกันชีวิต'));
    expect(row).toContain('-50,000');
    expect(row).not.toContain('จำกัดเพดาน');
  });

  it('ตารางภาษีรายขั้นแสดงเฉพาะขั้นที่มียอด (golden case = 3 ขั้น)', async () => {
    const { fixture } = await setup();
    const rows = query(fixture, '#bracketTable').querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent?.replace(/\s+/g, ' ')).toContain('10%');
  });

  it('แก้ข้อมูลขั้นก่อนหน้าแล้วกลับมา → ตัวเลขอัปเดตเอง (signals/computed)', async () => {
    const { fixture, store } = await setup();
    expect(calcRows(fixture)).toContain('เงินได้สุทธิ 440,000');
    store.saveIncome({ salary: 700_000, bonus: 0, otherIncome: 0, withholdingTax: 0 });
    await fixture.whenStable();
    expect(calcRows(fixture)).toContain('เงินได้สุทธิ 540,000');
  });

  it('กด "ยืนยันการคำนวณ" → ขั้น review mark เสร็จ + ไป result แบบ relative', async () => {
    const { fixture, store, navigate } = await setup();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    buttons.find((b) => b.textContent?.includes('ยืนยันการคำนวณ'))!.click();
    await fixture.whenStable();
    expect(store.completedSteps().has('review')).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['../result'], expect.anything());
  });
});
