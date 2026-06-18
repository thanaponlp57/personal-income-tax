import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TaxIdInputDirective } from './tax-id-input.directive';

/** Host เล็ก ๆ สำหรับเทสต์ directive ตรง ๆ — ไม่ผูกกับ step ไหนของ wizard */
@Component({
  imports: [ReactiveFormsModule, TaxIdInputDirective],
  template: '<input id="taxId" type="text" appTaxId [formControl]="taxId" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TaxIdInputHostComponent {
  readonly taxId = new FormControl('', { nonNullable: true });
}

const setup = async () => {
  TestBed.configureTestingModule({ imports: [TaxIdInputHostComponent] });
  const fixture = TestBed.createComponent(TaxIdInputHostComponent);
  await fixture.whenStable();
  return fixture;
};

const input = (fixture: ComponentFixture<TaxIdInputHostComponent>): HTMLInputElement =>
  fixture.nativeElement.querySelector('#taxId') as HTMLInputElement;

const typeInto = async (
  fixture: ComponentFixture<TaxIdInputHostComponent>,
  value: string,
): Promise<void> => {
  input(fixture).value = value;
  input(fixture).dispatchEvent(new Event('input'));
  await fixture.whenStable();
};

describe('tax id input directive (UX-07)', () => {
  it('paste รูปแบบบนบัตร 1-2345-67890-12-3 → model เลขล้วน 13 หลัก', async () => {
    const fixture = await setup();
    await typeInto(fixture, '1-2345-67890-12-3');
    expect(fixture.componentInstance.taxId.value).toBe('1234567890123');
    expect(input(fixture).value).toBe('1-2345-67890-12-3');
  });

  it('พิมพ์เลขล้วน → แสดงผล auto-format เป็น x-xxxx-xxxxx-xx-x', async () => {
    const fixture = await setup();
    await typeInto(fixture, '1234567890123');
    expect(input(fixture).value).toBe('1-2345-67890-12-3');
    expect(fixture.componentInstance.taxId.value).toBe('1234567890123');
  });

  it('เกิน 13 หลัก → ตัดที่ 13 หลัก', async () => {
    const fixture = await setup();
    await typeInto(fixture, '12345678901239999');
    expect(fixture.componentInstance.taxId.value).toBe('1234567890123');
  });
});
