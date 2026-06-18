import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TaxpayerProfile } from '../../models/tax.models';
import { TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { provideTaxApiMock } from '../../services/tax-api.service.mock';
import { TaxpayerStep } from './taxpayer-step';

const validProfile: TaxpayerProfile = {
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  taxId: '1234567890123',
  maritalStatus: 'single',
  spouseHasIncome: false,
};

const setup = async (existingProfile?: TaxpayerProfile) => {
  TestBed.configureTestingModule({
    imports: [TaxpayerStep],
    providers: [provideRouter([]), TaxWizardStore, TaxCalculatorService, provideTaxApiMock()],
  });
  const store = TestBed.inject(TaxWizardStore);
  if (existingProfile) store.saveProfile(existingProfile);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(TaxpayerStep);
  await fixture.whenStable();
  return { fixture, store, navigate };
};

const query = <T extends HTMLElement>(fixture: ComponentFixture<TaxpayerStep>, selector: string) =>
  fixture.nativeElement.querySelector(selector) as T;

const typeInto = async (
  fixture: ComponentFixture<TaxpayerStep>,
  id: string,
  value: string,
): Promise<void> => {
  const input = query<HTMLInputElement>(fixture, `#${id}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

const submitForm = async (fixture: ComponentFixture<TaxpayerStep>): Promise<void> => {
  query<HTMLFormElement>(fixture, 'form').dispatchEvent(new Event('submit'));
  await fixture.whenStable();
};

const fillValidForm = async (fixture: ComponentFixture<TaxpayerStep>): Promise<void> => {
  await typeInto(fixture, 'firstName', 'สมชาย');
  await typeInto(fixture, 'lastName', 'ใจดี');
  await typeInto(fixture, 'taxId', '1234567890123');
};

describe('TaxpayerStep', () => {
  it('ฟอร์มว่างกดถัดไป → ไม่ navigate และ error แสดงครบทุกช่อง', async () => {
    const { fixture, navigate } = await setup();
    await submitForm(fixture);
    expect(navigate).not.toHaveBeenCalled();
    for (const id of ['firstName', 'lastName', 'taxId']) {
      expect(query<HTMLInputElement>(fixture, `#${id}`).classList.contains('is-invalid')).toBe(
        true,
      );
    }
  });

  it('เลข 12 หลัก หรือมีตัวอักษร → invalid', async () => {
    const { fixture } = await setup();
    const taxId = fixture.componentInstance['form'].controls.taxId;
    taxId.setValue('123456789012');
    expect(taxId.invalid).toBe(true);
    taxId.setValue('12345678901ab');
    expect(taxId.invalid).toBe(true);
  });

  it('paste เลขจากบัตร 1-2345-67890-12-3 → model เป็นเลขล้วน 13 หลักและ valid (UX-07)', async () => {
    const { fixture } = await setup();
    await typeInto(fixture, 'taxId', '1-2345-67890-12-3');
    const taxId = fixture.componentInstance['form'].controls.taxId;
    expect(taxId.value).toBe('1234567890123');
    expect(taxId.valid).toBe(true);
    expect(query<HTMLInputElement>(fixture, '#taxId').value).toBe('1-2345-67890-12-3');
  });

  it('พิมพ์เลขล้วน → แสดงผล auto-format เป็น x-xxxx-xxxxx-xx-x', async () => {
    const { fixture } = await setup();
    await typeInto(fixture, 'taxId', '1234567890123');
    expect(query<HTMLInputElement>(fixture, '#taxId').value).toBe('1-2345-67890-12-3');
  });

  it('field ที่ error อยู่ พิมพ์แก้จนถูก → error หายทันทีไม่ต้องกดถัดไป (UX-04)', async () => {
    const { fixture } = await setup();
    await submitForm(fixture);
    const firstName = query<HTMLInputElement>(fixture, '#firstName');
    expect(firstName.classList.contains('is-invalid')).toBe(true);
    await typeInto(fixture, 'firstName', 'สมชาย');
    expect(firstName.classList.contains('is-invalid')).toBe(false);
  });

  it('submit ผ่าน Enter (submit event ของ form) → ทำงานเหมือนกดถัดไป (UX-08)', async () => {
    const { fixture, navigate } = await setup();
    await fillValidForm(fixture);
    await submitForm(fixture);
    expect(navigate).toHaveBeenCalledWith(['../income'], expect.anything());
  });

  it('กรอกครบ → store ได้ TaxpayerProfile ถูกต้อง + ขั้น 1 mark เสร็จ', async () => {
    const { fixture, store, navigate } = await setup();
    await fillValidForm(fixture);
    await submitForm(fixture);
    expect(store.profile()).toEqual(validProfile);
    expect(store.completedSteps().has('taxpayer')).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('เลือก "สมรส" จึงเห็นคำถามคู่สมรส และค่า spouse ถูกเซฟตามที่เลือก', async () => {
    const { fixture, store } = await setup();
    expect(query(fixture, '#spouseYes')).toBeNull();
    query<HTMLInputElement>(fixture, '#married').click();
    await fixture.whenStable();
    query<HTMLInputElement>(fixture, '#spouseYes').click();
    await fixture.whenStable();
    await fillValidForm(fixture);
    await submitForm(fixture);
    expect(store.profile()).toEqual({
      ...validProfile,
      maritalStatus: 'married',
      spouseHasIncome: true,
    });
  });

  it('กลับเป็น "โสด" → คำตอบคู่สมรสถูกล้างกลับค่าเริ่มต้น', async () => {
    const { fixture } = await setup();
    query<HTMLInputElement>(fixture, '#married').click();
    await fixture.whenStable();
    query<HTMLInputElement>(fixture, '#spouseYes').click();
    await fixture.whenStable();
    query<HTMLInputElement>(fixture, '#single').click();
    await fixture.whenStable();
    const form = fixture.componentInstance['form'];
    expect(form.controls.spouseHasIncome.value).toBe(false);
    expect(query(fixture, '#spouseYes')).toBeNull();
  });

  it('ย้อนกลับเข้ามาใหม่ → ค่าเดิมถูก patch กลับครบ', async () => {
    const married: TaxpayerProfile = {
      ...validProfile,
      maritalStatus: 'married',
      spouseHasIncome: true,
    };
    const { fixture } = await setup(married);
    expect(query<HTMLInputElement>(fixture, '#firstName').value).toBe('สมชาย');
    expect(query<HTMLInputElement>(fixture, '#lastName').value).toBe('ใจดี');
    expect(query<HTMLInputElement>(fixture, '#taxId').value).toBe('1-2345-67890-12-3');
    expect(query<HTMLInputElement>(fixture, '#married').checked).toBe(true);
    expect(query<HTMLInputElement>(fixture, '#spouseYes').checked).toBe(true);
  });

  it('กดบันทึกร่าง → store เก็บ profile แต่ไม่ mark step และไม่ navigate', async () => {
    const { fixture, store, navigate } = await setup();
    await fillValidForm(fixture);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    );
    buttons.find((b) => b.textContent?.includes('บันทึกร่าง'))!.click();
    await fixture.whenStable();
    expect(store.profile()).toEqual(validProfile);
    expect(store.completedSteps().has('taxpayer')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
