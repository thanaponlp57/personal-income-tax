import { caretAfterDigit } from './caret.util';

describe('caretAfterDigit', () => {
  it('digitIndex 0 → caret อยู่หน้าสุด', () => {
    expect(caretAfterDigit('1,200,000', 0)).toBe(0);
  });

  it('caret อยู่หลังตัวเลขลำดับที่กำหนด โดยข้ามอักขระคั่น', () => {
    // '1,200,000' — ตัวเลขลำดับที่ 4 คือ '0' ที่ index 4 → caret = 5
    expect(caretAfterDigit('1,200,000', 4)).toBe(5);
    // '1-2345-67890-12-3' — ตัวเลขลำดับที่ 5 คือ '5' ที่ index 5 → caret = 6
    expect(caretAfterDigit('1-2345-67890-12-3', 5)).toBe(6);
  });

  it('digitIndex เกินจำนวนตัวเลขในข้อความ → caret ท้ายสุด', () => {
    expect(caretAfterDigit('1,200', 99)).toBe(5);
  });

  it('ข้อความว่าง → 0 เสมอ', () => {
    expect(caretAfterDigit('', 0)).toBe(0);
    expect(caretAfterDigit('', 3)).toBe(0);
  });
});
