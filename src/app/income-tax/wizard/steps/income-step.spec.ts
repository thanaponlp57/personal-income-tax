import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { provideTaxApiMock } from '../../services/tax-api.service.mock';
import { IncomeStep } from './income-step';

const setup = async () => {
  TestBed.configureTestingModule({
    imports: [IncomeStep],
    providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
  });
  const store = TestBed.inject(TaxWizardStore);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(IncomeStep);
  await fixture.whenStable();
  return { fixture, store, navigate };
};

const query = <T extends HTMLElement>(fixture: ComponentFixture<IncomeStep>, selector: string) =>
  fixture.nativeElement.querySelector(selector) as T;

const typeInto = async (
  fixture: ComponentFixture<IncomeStep>,
  id: string,
  value: string,
): Promise<void> => {
  const input = query<HTMLInputElement>(fixture, `#${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

const submitForm = async (fixture: ComponentFixture<IncomeStep>): Promise<void> => {
  query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
  await fixture.whenStable();
};

describe('IncomeStep', () => {
  it('เงินเดือนว่าง/ศูนย์ → ฟอร์ม invalid กดถัดไปไม่ navigate', async () => {
    const { fixture, navigate } = await setup();
    await submitForm(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect(query<HTMLInputElement>(fixture, '#salary').classList.contains('is-invalid')).toBe(
      true,
    );
  });

  it('หัก ณ ที่จ่าย > เงินได้รวม → error ระดับฟอร์ม ไปต่อไม่ได้', async () => {
    const { fixture, navigate } = await setup();
    await typeInto(fixture, 'salary', '600000');
    await typeInto(fixture, 'withholdingTax', '700000');
    await submitForm(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect(
      query<HTMLInputElement>(fixture, '#withholdingTax').classList.contains('is-invalid'),
    ).toBe(true);
  });

  it('preview live: เงินได้ 600,000 → ค่าใช้จ่าย 100,000 ทันทีไม่ต้อง submit', async () => {
    const { fixture } = await setup();
    await typeInto(fixture, 'salary', '500000');
    await typeInto(fixture, 'bonus', '100000');
    const preview = query(fixture, '#incomePreview').textContent ?? '';
    expect(preview).toContain('600,000');
    expect(preview).toContain('100,000');
  });

  it('กรอกครบกดถัดไป → store ได้ EmploymentIncome + ขั้น 2 mark เสร็จ + ไป deductions', async () => {
    const { fixture, store, navigate } = await setup();
    await typeInto(fixture, 'salary', '600000');
    await typeInto(fixture, 'withholdingTax', '30000');
    await submitForm(fixture);
    expect(store.income()).toEqual({
      salary: 600_000,
      bonus: 0,
      otherIncome: 0,
      withholdingTax: 30_000,
    });
    expect(store.completedSteps().has('income')).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['../deductions'], expect.anything());
  });

  it('ย้อนกลับเข้ามาใหม่ → ค่าเดิมถูก patch กลับพร้อม format', async () => {
    TestBed.configureTestingModule({
      imports: [IncomeStep],
      providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
    });
    TestBed.inject(TaxWizardStore).saveIncome({
      salary: 600_000,
      bonus: 50_000,
      otherIncome: 0,
      withholdingTax: 0,
    });
    const fixture = TestBed.createComponent(IncomeStep);
    await fixture.whenStable();
    expect(query<HTMLInputElement>(fixture, '#salary').value).toBe('600,000');
    expect(query<HTMLInputElement>(fixture, '#bonus').value).toBe('50,000');
    expect(query<HTMLInputElement>(fixture, '#otherIncome').value).toBe('');
  });

  it('กดบันทึกร่าง → store เก็บ income แต่ไม่ mark step และไม่ navigate', async () => {
    const { fixture, store, navigate } = await setup();
    await typeInto(fixture, 'salary', '600000');
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    buttons.find((b) => b.textContent?.includes('บันทึกร่าง'))!.click();
    await fixture.whenStable();
    expect(store.income()?.salary).toBe(600_000);
    expect(store.completedSteps().has('income')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
