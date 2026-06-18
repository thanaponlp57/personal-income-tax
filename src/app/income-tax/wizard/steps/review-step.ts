import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TAX_CAPS } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';

/**
 * ขั้นที่ 4 — อ่านอย่างเดียว: ทุกตัวเลขมาจาก `store.computation()`
 * (คำนวณโดย TaxCalculatorService) — component นี้ไม่มีสูตรของตัวเอง
 */
@Component({
  selector: 'app-review-step',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './review-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewStep {
  protected readonly store = inject(TaxWizardStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly expenseRatePercent = TAX_CAPS.expenseRate * 100;
  protected readonly expenseMax = TAX_CAPS.expenseMax;
  /** ขั้นบนสุดของอัตราก้าวหน้า (`upTo: Infinity`) — template อ้าง global ตรง ๆ ไม่ได้ */
  protected readonly infinity = Infinity;

  protected readonly maritalText = computed(() => {
    const profile = this.store.profile();
    if (profile?.maritalStatus !== 'married') return 'โสด';
    return profile.spouseHasIncome ? 'สมรส (คู่สมรสแยกยื่น)' : 'สมรส (คู่สมรสไม่มีเงินได้)';
  });

  /** แสดงเฉพาะรายการที่มียอดใช้จริง หรือโดนตัดเพดาน (UX-09: ห้ามหายเงียบ ๆ) */
  protected readonly visibleAllowances = computed(
    () => this.store.computation()?.allowanceItems.filter((i) => i.used > 0 || i.capped) ?? [],
  );

  protected onBack(): void {
    this.router.navigate(['../deductions'], { relativeTo: this.route });
  }

  protected onConfirm(): void {
    this.store.confirmReview();
    this.router.navigate(['../result'], { relativeTo: this.route });
  }
}
