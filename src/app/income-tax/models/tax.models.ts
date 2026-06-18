export type MaritalStatus = 'single' | 'married';

/** ขั้น 1 — ข้อมูลผู้มีเงินได้ */
export interface TaxpayerProfile {
  firstName: string;
  lastName: string;
  /** เลขประจำตัวผู้เสียภาษี 13 หลัก (เก็บเป็น string กันเลข 0 นำหน้าหาย) */
  taxId: string;
  maritalStatus: MaritalStatus;
  spouseHasIncome: boolean;
}

/** ขั้น 2 — เงินได้ตามมาตรา 40(1) (บาท/ปี) */
export interface EmploymentIncome {
  salary: number;
  bonus: number;
  otherIncome: number;
  withholdingTax: number;
}

/** ขั้น 3 — ค่าลดหย่อนที่ผู้ใช้กรอก (จำนวนคน / บาทตามจ่ายจริง) */
export interface Deductions {
  children: number;
  parents: number;
  socialSecurity: number;
  lifeInsurance: number;
  providentFund: number;
  homeLoanInterest: number;
  donation: number;
}

/**
 * รายการลดหย่อน 1 รายการหลังผ่านเพดาน — `entered` เก็บยอดเดิมที่กรอกไว้เสมอ
 * เพื่อให้ขั้นตรวจสอบ annotate ค่าที่โดนตัดเพดานได้ ไม่ cap เงียบ ๆ (UX-09)
 */
export interface AllowanceItem {
  label: string;
  entered: number;
  used: number;
  capped: boolean;
}

/** ภาษี 1 ขั้นของอัตราก้าวหน้า — ใช้แสดงตาราง breakdown ในขั้นตรวจสอบ */
export interface TaxBracketPortion {
  from: number;
  upTo: number;
  amount: number;
  rate: number;
  tax: number;
}

/** ผลคำนวณภาษีทั้งใบ ภ.ง.ด.91 */
export interface TaxComputation {
  totalIncome: number;
  expense: number;
  allowanceItems: AllowanceItem[];
  allowancesTotal: number;
  netIncome: number;
  bracketPortions: TaxBracketPortion[];
  tax: number;
  /** ภาษีที่คำนวณได้ − หัก ณ ที่จ่าย: บวก = ชำระเพิ่ม, ลบ = ขอคืน */
  balance: number;
}
