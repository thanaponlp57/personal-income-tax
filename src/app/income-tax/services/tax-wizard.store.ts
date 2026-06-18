import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  concat,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  timer,
} from 'rxjs';
import {
  Deductions,
  EmploymentIncome,
  TaxComputation,
  TaxpayerProfile,
} from '../models/tax.models';
import { TaxCalculatorService } from './tax-calculator.service';
import { TaxApiService, DraftPayload } from './tax-api.service';

/** ลำดับขั้นของ wizard — path ของ child route ตรงกับชื่อขั้น */
export const WIZARD_STEPS = ['taxpayer', 'income', 'deductions', 'review', 'result'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** สถานะปุ่ม "บันทึกร่าง" — signal ตัวเดียวที่ share ทุก step → กดรัว ๆ โชว์แค่ล่าสุด */
export type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** ระยะเวลาโชว์ข้อความ "บันทึกร่างแล้ว ✓" ก่อนกลับ idle (ms) */
const DRAFT_SAVED_MESSAGE_MS = 2_500;

/**
 * State ของ wizard ทั้งตัว — provide ผ่าน `providers` ของ route `wizard` เท่านั้น
 * (ไม่ใช่ root singleton: ออกจาก wizard แล้ว state ถูกทำลาย เริ่มใหม่ = state ว่าง)
 */
@Injectable()
export class TaxWizardStore {
  private readonly calculator = inject(TaxCalculatorService);
  private readonly api = inject(TaxApiService);

  readonly profile = signal<TaxpayerProfile | null>(null);
  readonly income = signal<EmploymentIncome | null>(null);
  readonly deductions = signal<Deductions | null>(null);
  readonly completedSteps = signal<ReadonlySet<WizardStep>>(new Set());

  /** สถานะปุ่มบันทึกร่าง (ผู้ใช้กดเอง) — ดู `draftProfile/draftIncome/draftDeductions` */
  readonly draftSaveState = signal<DraftSaveState>('idle');
  private readonly saveDraftTrigger = new Subject<void>();

  constructor() {
    // กดบันทึกร่างรัว ๆ → switchMap ยกเลิก save ก่อนหน้า (และ timer reset) เหลือแค่ล่าสุด
    this.saveDraftTrigger
      .pipe(
        switchMap(() =>
          this.api.saveDraft(this.draftPayload()).pipe(
            switchMap(() =>
              concat(
                of('saved' as const),
                timer(DRAFT_SAVED_MESSAGE_MS).pipe(map(() => 'idle' as const)),
              ),
            ),
            startWith('saving' as const),
            catchError(() => of('error' as const)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.draftSaveState.set(state));
  }

  /** ผลคำนวณทั้งใบ — มีค่าเมื่อข้อมูลครบทั้ง 3 ขั้นแรก */
  readonly computation = computed<TaxComputation | null>(() => {
    const profile = this.profile();
    const income = this.income();
    const deductions = this.deductions();
    if (!profile || !income || !deductions) return null;
    return this.calculator.compute(profile, income, deductions);
  });

  // กด "ถัดไป" — set ข้อมูล + mark step เพื่อ guard นำทาง (ไม่ยิง BE; บันทึกผ่านปุ่มบันทึกร่าง)
  saveProfile(profile: TaxpayerProfile): void {
    this.profile.set(profile);
    this.markCompleted('taxpayer');
  }

  saveIncome(income: EmploymentIncome): void {
    this.income.set(income);
    this.markCompleted('income');
  }

  saveDeductions(deductions: Deductions): void {
    this.deductions.set(deductions);
    this.markCompleted('deductions');
  }

  // กด "บันทึกร่าง" — set ข้อมูลปัจจุบัน (ไม่ mark step → ไม่ปลดล็อกขั้นถัดไป) แล้ว trigger บันทึก BE
  draftProfile(profile: TaxpayerProfile): void {
    this.profile.set(profile);
    this.saveDraftTrigger.next();
  }

  draftIncome(income: EmploymentIncome): void {
    this.income.set(income);
    this.saveDraftTrigger.next();
  }

  draftDeductions(deductions: Deductions): void {
    this.deductions.set(deductions);
    this.saveDraftTrigger.next();
  }

  /** ผู้ใช้กด "ยืนยันการคำนวณ" ในขั้นตรวจสอบ → ปลดล็อกขั้นสรุปผล */
  confirmReview(): void {
    this.markCompleted('review');
  }

  /** ขั้นแรกเข้าได้เสมอ ขั้นที่ n เข้าได้เมื่อขั้นที่ n−1 เสร็จแล้ว */
  canAccess(step: WizardStep): boolean {
    const index = WIZARD_STEPS.indexOf(step);
    return index === 0 || this.completedSteps().has(WIZARD_STEPS[index - 1]);
  }

  /**
   * โหลด draft จาก BE — คืน Observable เพื่อให้ guard รอจนเสร็จ "ก่อน" เข้า step
   * (กัน race: completedSteps/ค่าฟอร์มต้อง restore ก่อน canActivateStep และก่อน component patch)
   * BE คืน null (404) = ไม่มี draft, ไม่ทำอะไร
   */
  loadDraft(): Observable<void> {
    return this.api.getDraft().pipe(
      map((draft) => {
        if (!draft) return;
        this.profile.set(draft.profile);
        this.income.set(draft.income);
        this.deductions.set(draft.deductions);
        this.completedSteps.set(new Set(draft.completedSteps));
      }),
    );
  }

  private draftPayload(): DraftPayload {
    return {
      profile: this.profile(),
      income: this.income(),
      deductions: this.deductions(),
      completedSteps: [...this.completedSteps()],
    };
  }

  /** ลบ draft ฝั่ง BE — เรียกหลัง submit สำเร็จ */
  clearDraft(): void {
    this.api.deleteDraft().subscribe();
  }

  reset(): void {
    this.profile.set(null);
    this.income.set(null);
    this.deductions.set(null);
    this.completedSteps.set(new Set());
  }

  private markCompleted(step: WizardStep): void {
    this.completedSteps.update((steps) => new Set(steps).add(step));
  }
}
