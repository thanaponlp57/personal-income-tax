import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AllowanceItem, Deductions } from '../../models/tax.models';
import { TAX_CAPS, TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { MoneyInputDirective } from '../../directives/money-input.directive';

/** ขอบเขตช่องจำนวนบุตรในฟอร์ม (ข้อจำกัด UI ตาม task ไม่ใช่กฎภาษี — กฎบุตรไม่มีเพดานคน) */
const CHILDREN_FORM_MAX = 10;

const COUNT_VALIDATORS = (max: number) => [
  Validators.required,
  Validators.pattern(/^\d+$/),
  Validators.min(0),
  Validators.max(max),
];

@Component({
  selector: 'app-deductions-step',
  imports: [ReactiveFormsModule, MoneyInputDirective, DecimalPipe],
  templateUrl: './deductions-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeductionsStep {
  protected readonly store = inject(TaxWizardStore);
  private readonly calculator = inject(TaxCalculatorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly caps = TAX_CAPS;
  protected readonly childrenMax = CHILDREN_FORM_MAX;
  protected readonly pvdRatePercent = TAX_CAPS.pvdRate * 100;
  protected readonly donationRatePercent = TAX_CAPS.donationRate * 100;

  protected readonly form = this.fb.group({
    children: [0, COUNT_VALIDATORS(CHILDREN_FORM_MAX)],
    parents: [0, COUNT_VALIDATORS(TAX_CAPS.parentsMax)],
    socialSecurity: [0],
    lifeInsurance: [0],
    providentFund: [0],
    homeLoanInterest: [0],
    donation: [0],
  });

  /** ลดหย่อนอัตโนมัติด้านบนฟอร์ม — คู่สมรสตามคำตอบขั้น 1 */
  protected readonly spouseEligible = computed(() => {
    const profile = this.store.profile();
    return profile?.maritalStatus === 'married' && !profile.spouseHasIncome;
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** เพดานทุกตัวตัดโดย service เท่านั้น — component แค่ bind ผลลัพธ์ */
  protected readonly allowances = computed(() => {
    const profile = this.store.profile();
    const income = this.store.income();
    if (!profile || !income) return { items: [] as AllowanceItem[], total: 0 };
    return this.calculator.allowances(
      profile,
      DeductionsStep.normalize(this.formValue()),
      income.salary + income.bonus + income.otherIncome,
    );
  });

  private readonly itemsByLabel = computed(
    () => new Map(this.allowances().items.map((item) => [item.label, item])),
  );

  /** รายการที่กรอกเกินเพดานตอนนี้ — ใช้โชว์ hint สีเหลืองใต้ช่อง */
  protected cappedItem(label: string): AllowanceItem | undefined {
    const item = this.itemsByLabel().get(label);
    return item?.capped ? item : undefined;
  }

  constructor() {
    const saved = this.store.deductions();
    if (saved) this.form.patchValue(saved);
  }

  protected onBack(): void {
    this.router.navigate(['../income'], { relativeTo: this.route });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.saveDeductions(DeductionsStep.normalize(this.form.getRawValue()));
    this.router.navigate(['../review'], { relativeTo: this.route });
  }

  protected onSaveDraft(): void {
    this.store.draftDeductions(DeductionsStep.normalize(this.form.getRawValue()));
  }

  /**
   * เซฟ/คำนวณด้วยค่าตามที่กรอก (entered) — การตัดเพดานเป็นหน้าที่ service (UX-09)
   * ช่องจำนวนคนอาจเป็น null/ไม่ใช่เลขระหว่างพิมพ์ → ปัดเป็น 0 เพื่อให้ preview ไม่พัง
   */
  private static normalize(value: ReturnType<DeductionsStep['form']['getRawValue']>): Deductions {
    return {
      ...value,
      children: Number(value.children) || 0,
      parents: Number(value.parents) || 0,
    };
  }
}
