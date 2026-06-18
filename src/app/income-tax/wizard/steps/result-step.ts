import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TaxWizardStore } from '../../services/tax-wizard.store';
import { TaxApiService, FilingResult } from '../../services/tax-api.service';
import { TaxComputation } from '../../models/tax.models';

type SubmitState = 'idle' | 'submitting' | 'done' | 'error';
type ReceiptState = 'waiting' | 'ready' | 'failed';

/**
 * ขั้นที่ 5 — สรุปผล (live preview จาก `store.computation()`) + ส่งแบบไป BE
 * หลัง submit แสดงภาษีที่ BE คำนวณ, poll receipt จนพร้อม แล้วดาวน์โหลด PDF
 */
@Component({
  selector: 'app-result-step',
  imports: [DecimalPipe],
  templateUrl: './result-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultStep {
  protected readonly store = inject(TaxWizardStore);
  private readonly api = inject(TaxApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submitState = signal<SubmitState>('idle');
  protected readonly receiptState = signal<ReceiptState>('waiting');
  protected readonly beComputation = signal<TaxComputation | null>(null);
  protected readonly filingId = signal<string | null>(null);

  private receiptPollTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // หยุด poll timer ตอนออกจากหน้า — กัน timer ยิงต่อ + set signal บน component ที่ destroy แล้ว
    this.destroyRef.onDestroy(() => clearTimeout(this.receiptPollTimer));
  }

  protected onBack(): void {
    this.router.navigate(['../review'], { relativeTo: this.route });
  }

  protected onPrint(): void {
    window.print();
  }

  protected onSubmit(): void {
    const profile = this.store.profile();
    const income = this.store.income();
    const deductions = this.store.deductions();
    if (!profile || !income || !deductions) return;

    this.submitState.set('submitting');
    this.api
      .submitFiling(profile, income, deductions)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: FilingResult) => {
          this.filingId.set(result.id);
          this.beComputation.set(result.computation);
          this.submitState.set('done');
          this.store.clearDraft();
          this.pollReceipt(result.id, 0);
        },
        error: () => this.submitState.set('error'),
      });
  }

  protected onDownloadReceipt(): void {
    const id = this.filingId();
    if (!id) return;
    this.api
      .getReceipt(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  /** ลบข้อมูลทั้งหมด — ต้องยืนยันก่อน แล้วกลับขั้นแรกแบบ relative (guard จะล็อกขั้นอื่นเอง) */
  protected onRestart(): void {
    clearTimeout(this.receiptPollTimer);
    const confirmed = window.confirm(
      'เริ่มกรอกใหม่ทั้งหมดหรือไม่? ข้อมูลที่กรอกไว้จะถูกลบทั้งหมด',
    );
    if (!confirmed) return;
    this.store.clearDraft();
    this.store.reset();
    this.router.navigate(['../taxpayer'], { relativeTo: this.route });
  }

  /** receipt PDF สร้าง async (RabbitMQ) — BE ตอบ 404 จนพร้อม: poll ทุก 3 วิ สูงสุด 10 ครั้ง */
  private pollReceipt(id: string, attempt: number): void {
    if (attempt >= 10) {
      this.receiptState.set('failed');
      return;
    }
    this.receiptPollTimer = setTimeout(() => {
      this.api
        .getReceipt(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.receiptState.set('ready'),
          error: () => this.pollReceipt(id, attempt + 1),
        });
    }, 3_000);
  }
}
