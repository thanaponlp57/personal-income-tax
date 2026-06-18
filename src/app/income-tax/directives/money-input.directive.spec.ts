import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MoneyInputDirective } from './money-input.directive';

/** Host เล็ก ๆ สำหรับเทสต์ directive ตรง ๆ — ไม่ผูกกับ step ไหนของ wizard */
@Component({
  imports: [ReactiveFormsModule, MoneyInputDirective],
  template: '<input id="amount" type="text" appMoney [formControl]="amount" placeholder="0" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MoneyInputHostComponent {
  readonly amount = new FormControl(0, { nonNullable: true });
}

const setup = async () => {
  TestBed.configureTestingModule({ imports: [MoneyInputHostComponent] });
  const fixture = TestBed.createComponent(MoneyInputHostComponent);
  await fixture.whenStable();
  return fixture;
};

const input = (fixture: ComponentFixture<MoneyInputHostComponent>): HTMLInputElement =>
  fixture.nativeElement.querySelector('#amount') as HTMLInputElement;

const typeInto = async (
  fixture: ComponentFixture<MoneyInputHostComponent>,
  value: string,
): Promise<void> => {
  input(fixture).value = value;
  input(fixture).dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

describe('money input directive (UX-05/06)', () => {
  it('พิมพ์ 1200000 → แสดง 1,200,000 และ model เป็น number 1200000', async () => {
    const fixture = await setup();
    await typeInto(fixture, '1200000');
    expect(input(fixture).value).toBe('1,200,000');
    expect(fixture.componentInstance.amount.value).toBe(1_200_000);
  });

  it('paste 1,200,000 → model = 1200000', async () => {
    const fixture = await setup();
    await typeInto(fixture, '1,200,000');
    expect(fixture.componentInstance.amount.value).toBe(1_200_000);
  });

  it('พิมพ์ 015000 (เลข 0 นำหน้า) → model = 15000', async () => {
    const fixture = await setup();
    await typeInto(fixture, '015000');
    expect(fixture.componentInstance.amount.value).toBe(15_000);
    expect(input(fixture).value).toBe('15,000');
  });

  it('model เริ่มต้น 0 → ช่องว่างพร้อม placeholder 0 — ไม่ prefill ค่า 0 จริง', async () => {
    const fixture = await setup();
    expect(input(fixture).value).toBe('');
    expect(input(fixture).placeholder).toBe('0');
  });

  it('ลบจนช่องว่าง → model = 0', async () => {
    const fixture = await setup();
    await typeInto(fixture, '600000');
    await typeInto(fixture, '');
    expect(fixture.componentInstance.amount.value).toBe(0);
  });
});
