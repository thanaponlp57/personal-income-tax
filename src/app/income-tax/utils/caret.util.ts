/**
 * ตำแหน่ง caret ในข้อความที่ format แล้ว ให้อยู่หลังตัวเลขลำดับที่ `digitIndex`
 * — ใช้ร่วมกันระหว่าง input ที่ format สดขณะพิมพ์ (เลขผู้เสียภาษี, ช่องเงิน)
 * เพื่อไม่ให้ caret กระโดดผิดที่เมื่อมีอักขระคั่น (ขีด/คอมมา) ถูกแทรก/ย้าย
 */
export const caretAfterDigit = (formatted: string, digitIndex: number): number => {
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) seen++;
    if (seen === digitIndex) return i + 1;
  }
  return formatted.length;
};
