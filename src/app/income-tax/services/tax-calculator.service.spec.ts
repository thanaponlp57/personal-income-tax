import { Deductions, EmploymentIncome, TaxpayerProfile } from '../models/tax.models';
import { TaxCalculatorService } from './tax-calculator.service';

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

const employmentIncome = (salary: number, withholdingTax = 0): EmploymentIncome => ({
  salary,
  bonus: 0,
  otherIncome: 0,
  withholdingTax,
});

const findItem = (items: { label: string }[], label: string) => {
  const item = items.find((i) => i.label === label);
  if (!item) throw new Error(`ไม่พบรายการลดหย่อน: ${label}`);
  return item as { label: string; entered: number; used: number; capped: boolean };
};

describe('TaxCalculatorService', () => {
  const service = new TaxCalculatorService();

  describe('expense', () => {
    it('หัก 50% เมื่อยังไม่ชนเพดาน: เงินได้ 150,000 → 75,000', () => {
      expect(service.expense(150_000)).toBe(75_000);
    });

    it('ชนเพดาน 100,000: เงินได้ 1,000,000 → 100,000', () => {
      expect(service.expense(1_000_000)).toBe(100_000);
    });
  });

  describe('progressiveTax', () => {
    it('สุทธิ 150,000 → ภาษี 0 (ขั้นยกเว้น)', () => {
      const { total, portions } = service.progressiveTax(150_000);
      expect(total).toBe(0);
      expect(portions).toEqual([{ from: 0, upTo: 150_000, amount: 150_000, rate: 0, tax: 0 }]);
    });

    it('สุทธิ 150,001 → ภาษี 0.05 (เริ่มขั้น 5% ที่บาทแรกเกิน 150,000)', () => {
      const { total } = service.progressiveTax(150_001);
      expect(total).toBeCloseTo(0.05);
    });

    it('สุทธิ 300,000 → ภาษี 7,500 (เต็มขั้น 5%)', () => {
      expect(service.progressiveTax(300_000).total).toBe(7_500);
    });

    it('สุทธิติดลบ → ภาษี 0 และไม่มี breakdown', () => {
      const { total, portions } = service.progressiveTax(-50_000);
      expect(total).toBe(0);
      expect(portions).toEqual([]);
    });
  });

  describe('allowances — เพดานแต่ละรายการ (UX-09: เก็บ entered + ติด capped)', () => {
    const allowancesWith = (partial: Partial<Deductions>, income = 1_000_000) =>
      service.allowances(singleProfile, { ...noDeductions, ...partial }, income);

    it('ลดหย่อนส่วนตัว 60,000 ได้อัตโนมัติทุกคน', () => {
      const { items, total } = allowancesWith({});
      expect(findItem(items, 'ลดหย่อนส่วนตัว').used).toBe(60_000);
      expect(total).toBe(60_000);
    });

    it('คู่สมรสไม่มีเงินได้ → ลดหย่อน 60,000 / มีเงินได้ → 0', () => {
      const married: TaxpayerProfile = { ...singleProfile, maritalStatus: 'married' };
      const noIncome = service.allowances(married, noDeductions, 1_000_000);
      expect(findItem(noIncome.items, 'คู่สมรสไม่มีเงินได้').used).toBe(60_000);
      const hasIncome = service.allowances(
        { ...married, spouseHasIncome: true },
        noDeductions,
        1_000_000,
      );
      expect(findItem(hasIncome.items, 'คู่สมรสไม่มีเงินได้').used).toBe(0);
    });

    it('บุตร 30,000/คน', () => {
      const { items } = allowancesWith({ children: 2 });
      expect(findItem(items, 'บุตร').used).toBe(60_000);
    });

    it('บิดามารดาเกิน 4 คน → ตัดที่ 120,000 และติด capped', () => {
      const { items } = allowancesWith({ parents: 5 });
      const parents = findItem(items, 'บิดามารดา');
      expect(parents.entered).toBe(150_000);
      expect(parents.used).toBe(120_000);
      expect(parents.capped).toBe(true);
    });

    it('ประกันสังคมเกิน 9,000 → ตัดที่เพดาน', () => {
      const { items } = allowancesWith({ socialSecurity: 20_000 });
      const sso = findItem(items, 'ประกันสังคม');
      expect(sso.entered).toBe(20_000);
      expect(sso.used).toBe(9_000);
      expect(sso.capped).toBe(true);
    });

    it('เบี้ยประกันชีวิตเกิน 100,000 → ตัดที่เพดาน', () => {
      const { items } = allowancesWith({ lifeInsurance: 250_000 });
      const life = findItem(items, 'เบี้ยประกันชีวิต');
      expect(life.used).toBe(100_000);
      expect(life.capped).toBe(true);
    });

    it('PVD ตัดที่ 15% ของเงินได้: เงินได้ 1,000,000 กรอก 200,000 → ใช้ได้ 150,000', () => {
      const { items } = allowancesWith({ providentFund: 200_000 });
      const pvd = findItem(items, 'กองทุนสำรองเลี้ยงชีพ');
      expect(pvd.entered).toBe(200_000);
      expect(pvd.used).toBe(150_000);
      expect(pvd.capped).toBe(true);
    });

    it('PVD ตัดที่เพดานสัมบูรณ์ 500,000 แม้ 15% จะสูงกว่า', () => {
      const { items } = allowancesWith({ providentFund: 600_000 }, 10_000_000);
      expect(findItem(items, 'กองทุนสำรองเลี้ยงชีพ').used).toBe(500_000);
    });

    it('ดอกเบี้ยบ้านเกิน 100,000 → ตัดที่เพดาน', () => {
      const { items } = allowancesWith({ homeLoanInterest: 150_000 });
      const loan = findItem(items, 'ดอกเบี้ยกู้ยืมที่อยู่อาศัย');
      expect(loan.used).toBe(100_000);
      expect(loan.capped).toBe(true);
    });

    it('บริจาคตัดที่ 10% ของเงินได้หลังหักค่าใช้จ่าย+ลดหย่อนอื่น', () => {
      // เงินได้ 600,000 − ค่าใช้จ่าย 100,000 − ส่วนตัว 60,000 = 440,000 → เพดาน 44,000
      const { items } = allowancesWith({ donation: 100_000 }, 600_000);
      const donation = findItem(items, 'เงินบริจาคทั่วไป');
      expect(donation.entered).toBe(100_000);
      expect(donation.used).toBe(44_000);
      expect(donation.capped).toBe(true);
    });

    it('รายการไม่ชนเพดาน → used = entered และ capped = false', () => {
      const { items } = allowancesWith({ socialSecurity: 5_000 });
      const sso = findItem(items, 'ประกันสังคม');
      expect(sso.used).toBe(5_000);
      expect(sso.capped).toBe(false);
    });
  });

  describe('compute', () => {
    it('golden case: เงินได้ 600,000 โสด ไม่มีลดหย่อนอื่น → ภาษี 21,500', () => {
      const result = service.compute(singleProfile, employmentIncome(600_000), noDeductions);
      expect(result.totalIncome).toBe(600_000);
      expect(result.expense).toBe(100_000);
      expect(result.allowancesTotal).toBe(60_000);
      expect(result.netIncome).toBe(440_000);
      expect(result.tax).toBe(21_500);
      expect(result.balance).toBe(21_500);
      expect(result.bracketPortions).toEqual([
        { from: 0, upTo: 150_000, amount: 150_000, rate: 0, tax: 0 },
        { from: 150_000, upTo: 300_000, amount: 150_000, rate: 0.05, tax: 7_500 },
        { from: 300_000, upTo: 500_000, amount: 140_000, rate: 0.1, tax: 14_000 },
      ]);
    });

    it('รวมเงินได้จากเงินเดือน + โบนัส + เงินได้อื่น', () => {
      const result = service.compute(
        singleProfile,
        { salary: 400_000, bonus: 150_000, otherIncome: 50_000, withholdingTax: 0 },
        noDeductions,
      );
      expect(result.totalIncome).toBe(600_000);
      expect(result.tax).toBe(21_500);
    });

    it('ลดหย่อนมากกว่าเงินได้ → เงินได้สุทธิ 0 ภาษี 0 (ไม่ติดลบ)', () => {
      const result = service.compute(
        singleProfile,
        employmentIncome(100_000),
        { ...noDeductions, lifeInsurance: 100_000 },
      );
      expect(result.netIncome).toBe(0);
      expect(result.tax).toBe(0);
    });

    it('หัก ณ ที่จ่ายมากกว่าภาษี → balance ติดลบ (ขอคืน)', () => {
      const result = service.compute(
        singleProfile,
        employmentIncome(600_000, 30_000),
        noDeductions,
      );
      expect(result.balance).toBe(-8_500);
    });
  });
});
