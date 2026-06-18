import { Injectable } from '@angular/core';
import {
  AllowanceItem,
  Deductions,
  EmploymentIncome,
  TaxBracketPortion,
  TaxComputation,
  TaxpayerProfile,
} from '../models/tax.models';

/**
 * กฎภาษีปี 2568 (scope MVP) — ที่เดียวที่มีตัวเลขเหล่านี้
 */
export const TAX_CAPS = {
  expenseRate: 0.5,
  expenseMax: 100_000,
  personal: 60_000,
  spouse: 60_000,
  childEach: 30_000,
  parentEach: 30_000,
  parentsMax: 4,
  socialSecurity: 9_000,
  lifeInsurance: 100_000,
  pvdRate: 0.15,
  pvdMax: 500_000,
  homeLoan: 100_000,
  donationRate: 0.1,
} as const;

export interface TaxBracket {
  upTo: number;
  rate: number;
}

export const TAX_BRACKETS: readonly TaxBracket[] = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

/** Pure ทั้ง class — ไม่เก็บ state, provide ใต้ route wizard ใน task-02 */
@Injectable()
export class TaxCalculatorService {
  /** ค่าใช้จ่าย 50% ของเงินได้ เพดาน 100,000 */
  expense(income: number): number {
    return Math.min(income * TAX_CAPS.expenseRate, TAX_CAPS.expenseMax);
  }

  /**
   * ค่าลดหย่อนทุกรายการหลังบังคับเพดาน — เพดาน PVD คิด 15% ของเงินได้รวม
   * และเพดานบริจาค 10% ของเงินได้หลังหักค่าใช้จ่ายและลดหย่อนอื่น (คิดท้ายสุด)
   */
  allowances(
    profile: TaxpayerProfile,
    deductions: Deductions,
    income: number,
  ): { items: AllowanceItem[]; total: number } {
    const item = (label: string, entered: number, cap: number): AllowanceItem => ({
      label,
      entered,
      used: Math.min(entered, cap),
      capped: entered > cap,
    });
    const spouseEligible = profile.maritalStatus === 'married' && !profile.spouseHasIncome;
    const items: AllowanceItem[] = [
      item('ลดหย่อนส่วนตัว', TAX_CAPS.personal, TAX_CAPS.personal),
      item('คู่สมรสไม่มีเงินได้', spouseEligible ? TAX_CAPS.spouse : 0, TAX_CAPS.spouse),
      item('บุตร', deductions.children * TAX_CAPS.childEach, Infinity),
      item(
        'บิดามารดา',
        deductions.parents * TAX_CAPS.parentEach,
        TAX_CAPS.parentsMax * TAX_CAPS.parentEach,
      ),
      item('ประกันสังคม', deductions.socialSecurity, TAX_CAPS.socialSecurity),
      item('เบี้ยประกันชีวิต', deductions.lifeInsurance, TAX_CAPS.lifeInsurance),
      item(
        'กองทุนสำรองเลี้ยงชีพ',
        deductions.providentFund,
        Math.min(income * TAX_CAPS.pvdRate, TAX_CAPS.pvdMax),
      ),
      item('ดอกเบี้ยกู้ยืมที่อยู่อาศัย', deductions.homeLoanInterest, TAX_CAPS.homeLoan),
    ];
    const beforeDonation = items.reduce((sum, i) => sum + i.used, 0);
    const donationCap = Math.max(
      0,
      (income - this.expense(income) - beforeDonation) * TAX_CAPS.donationRate,
    );
    const donation = item('เงินบริจาคทั่วไป', deductions.donation, donationCap);
    items.push(donation);
    return { items, total: beforeDonation + donation.used };
  }

  /** ภาษีอัตราก้าวหน้า 8 ขั้น — คืนยอดรวมพร้อม breakdown รายขั้น */
  progressiveTax(netIncome: number): { total: number; portions: TaxBracketPortion[] } {
    const portions: TaxBracketPortion[] = [];
    let prev = 0;
    let total = 0;
    for (const bracket of TAX_BRACKETS) {
      const amount = Math.min(netIncome, bracket.upTo) - prev;
      if (amount <= 0) break;
      const tax = amount * bracket.rate;
      portions.push({ from: prev, upTo: bracket.upTo, amount, rate: bracket.rate, tax });
      total += tax;
      prev = bracket.upTo;
    }
    return { total, portions };
  }

  compute(
    profile: TaxpayerProfile,
    income: EmploymentIncome,
    deductions: Deductions,
  ): TaxComputation {
    const totalIncome = income.salary + income.bonus + income.otherIncome;
    const expense = this.expense(totalIncome);
    const { items, total: allowancesTotal } = this.allowances(profile, deductions, totalIncome);
    const netIncome = Math.max(0, totalIncome - expense - allowancesTotal);
    const { total: tax, portions } = this.progressiveTax(netIncome);
    return {
      totalIncome,
      expense,
      allowanceItems: items,
      allowancesTotal,
      netIncome,
      bracketPortions: portions,
      tax,
      balance: tax - income.withholdingTax,
    };
  }
}
