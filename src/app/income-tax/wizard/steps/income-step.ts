import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TAX_CAPS, TaxCalculatorService } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { MoneyInputDirective } from '../../directives/money-input.directive';

/** Cross-field: หัก ณ ที่จ่ายต้องไม่เกินเงินได้รวมทั้ง 3 ช่อง */
const withholdingWithinIncome = (group: AbstractControl): ValidationErrors | null => {
  const { salary, bonus, otherIncome, withholdingTax } = group.getRawValue() as Record<
    string,
    number
  >;
  return withholdingTax > salary + bonus + otherIncome ? { withholdingExceedsIncome: true } : null;
};

@Component({
  selector: 'app-income-step',
  imports: [ReactiveFormsModule, MoneyInputDirective, DecimalPipe],
  templateUrl: './income-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeStep {
  protected readonly store = inject(TaxWizardStore);
  private readonly calculator = inject(TaxCalculatorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly expenseRatePercent = TAX_CAPS.expenseRate * 100;
  protected readonly expenseMax = TAX_CAPS.expenseMax;

  protected readonly form = this.fb.group(
    {
      // ช่องว่าง = 0 จาก MoneyInputDirective → ใช้ min(1) แทน required (เงินเดือนต้อง > 0)
      salary: [0, Validators.min(1)],
      bonus: [0],
      otherIncome: [0],
      withholdingTax: [0],
    },
    { validators: withholdingWithinIncome },
  );

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly totalIncome = computed(() => {
    const { salary, bonus, otherIncome } = this.formValue();
    return salary + bonus + otherIncome;
  });
  protected readonly expense = computed(() => this.calculator.expense(this.totalIncome()));

  constructor() {
    const saved = this.store.income();
    if (saved) this.form.patchValue(saved);
  }

  protected onBack(): void {
    this.router.navigate(['../taxpayer'], { relativeTo: this.route });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.saveIncome(this.form.getRawValue());
    this.router.navigate(['../deductions'], { relativeTo: this.route });
  }

  protected onSaveDraft(): void {
    this.store.draftIncome(this.form.getRawValue());
  }
}
