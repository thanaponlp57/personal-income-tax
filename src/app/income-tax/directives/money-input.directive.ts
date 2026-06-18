import { Directive, ElementRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { caretAfterDigit } from '../utils/caret.util';

/** เลขล้วนหลังตัด comma/ช่องว่าง/อักขระอื่น และ normalize เลข 0 นำหน้า (UX-05) */
const toDigits = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const format = (digits: string): string => (digits ? Number(digits).toLocaleString('th-TH') : '');

/**
 * ช่องเงินของ wizard (UX-05/06): ค่าใน form model เป็น number เสมอ
 * — แสดงผลคั่นหลักพันสดขณะพิมพ์โดย caret ไม่กระโดด, รองรับ paste ที่มี comma/ช่องว่าง,
 * ช่องว่าง = 0 ใน model (ห้าม prefill `0` จริง — ใช้ `placeholder="0"` ที่ template แทน)
 */
@Directive({
  selector: 'input[appMoney]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: MoneyInputDirective, multi: true }],
  host: {
    inputmode: 'numeric',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class MoneyInputDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  private onChange: (value: number) => void = () => {};
  protected onTouched: () => void = () => {};

  /** 0/null จาก model = ยังไม่กรอก → ช่องว่างให้ placeholder ทำงาน (UX-05) */
  writeValue(value: number | null): void {
    this.input.value = value ? format(String(value)) : '';
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.input.disabled = isDisabled;
  }

  protected onInput(): void {
    const raw = this.input.value;
    const digitsBeforeCaret = toDigits(
      raw.slice(0, this.input.selectionStart ?? raw.length),
    ).length;
    const digits = toDigits(raw);
    this.input.value = format(digits);
    const caret = caretAfterDigit(this.input.value, Math.min(digitsBeforeCaret, digits.length));
    this.input.setSelectionRange(caret, caret);
    this.onChange(digits ? Number(digits) : 0);
  }
}
