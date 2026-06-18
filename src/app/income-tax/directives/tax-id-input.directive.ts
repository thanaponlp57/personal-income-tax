import { Directive, ElementRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { caretAfterDigit } from '../utils/caret.util';

const TAX_ID_LENGTH = 13;
/** จุดคั่นบนบัตรจริง: x-xxxx-xxxxx-xx-x */
const GROUP_ENDS = [1, 5, 10, 12, 13] as const;

const stripDigits = (value: string): string =>
  value.replace(/\D/g, '').slice(0, TAX_ID_LENGTH);

const formatTaxId = (digits: string): string => {
  const groups: string[] = [];
  let start = 0;
  for (const end of GROUP_ENDS) {
    const group = digits.slice(start, end);
    if (!group) break;
    groups.push(group);
    start = end;
  }
  return groups.join('-');
};

/**
 * ช่องเลขประจำตัวผู้เสียภาษี (UX-07): strip ทุกอักขระที่ไม่ใช่ตัวเลขตอนพิมพ์/paste
 * (รองรับ paste รูปแบบบนบัตร `1-2345-67890-12-3`) แสดงผล auto-format
 * เป็น `x-xxxx-xxxxx-xx-x` ส่วนค่าใน form model เป็นเลขล้วนไม่เกิน 13 หลัก
 */
@Directive({
  selector: 'input[appTaxId]',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: TaxIdInputDirective, multi: true }],
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
})
export class TaxIdInputDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.input.value = formatTaxId(stripDigits(value ?? ''));
  }

  registerOnChange(fn: (value: string) => void): void {
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
    const digitsBeforeCaret = stripDigits(
      raw.slice(0, this.input.selectionStart ?? raw.length),
    ).length;
    const digits = stripDigits(raw);
    this.input.value = formatTaxId(digits);
    const caret = caretAfterDigit(this.input.value, digitsBeforeCaret);
    this.input.setSelectionRange(caret, caret);
    this.onChange(digits);
  }
}
