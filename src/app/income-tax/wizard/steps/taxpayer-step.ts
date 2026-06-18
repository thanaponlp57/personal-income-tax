import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaritalStatus, TaxpayerProfile } from '../../models/tax.models';
import { TAX_CAPS } from '../../services/tax-calculator.service';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { TaxIdInputDirective } from '../../directives/tax-id-input.directive';

@Component({
  selector: 'app-taxpayer-step',
  imports: [ReactiveFormsModule, TaxIdInputDirective, DecimalPipe],
  templateUrl: './taxpayer-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxpayerStep {
  protected readonly store = inject(TaxWizardStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly spouseAllowance = TAX_CAPS.spouse;

  protected readonly form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    // MVP เช็คแค่ตัวเลข 13 หลัก — validator แบบ checksum เต็มรูปอยู่ใน backlog (README ข้อ 6)
    taxId: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    maritalStatus: this.fb.control<MaritalStatus>('single'),
    spouseHasIncome: [false],
  });

  private readonly maritalStatus = toSignal(this.form.controls.maritalStatus.valueChanges, {
    initialValue: this.form.controls.maritalStatus.value,
  });
  protected readonly isMarried = computed(() => this.maritalStatus() === 'married');

  constructor() {
    const saved = this.store.profile();
    if (saved) this.form.patchValue(saved);
    // กลับเป็น "โสด" → ล้างคำตอบคู่สมรสกลับค่าเริ่มต้น
    this.form.controls.maritalStatus.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => {
        if (status === 'single') this.form.controls.spouseHasIncome.reset();
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.saveProfile(this.currentProfile());
    this.router.navigate(['../income'], { relativeTo: this.route });
  }

  protected onSaveDraft(): void {
    this.store.draftProfile(this.currentProfile());
  }

  private currentProfile(): TaxpayerProfile {
    const value = this.form.getRawValue();
    return {
      ...value,
      spouseHasIncome: value.maritalStatus === 'married' && value.spouseHasIncome,
    };
  }
}
