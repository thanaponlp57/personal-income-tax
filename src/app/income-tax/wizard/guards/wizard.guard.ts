import { inject } from '@angular/core';
import { CanActivateFn, createUrlTreeFromSnapshot } from '@angular/router';
import { map } from 'rxjs';
import { TaxWizardStore, WIZARD_STEPS, WizardStep } from '../../services/tax-wizard.store';

/**
 * โหลด draft จาก BE ให้เสร็จ "ก่อน" canActivateStep ของ child และก่อน step component patch ฟอร์ม
 * วางบน parent wizard route → run ครั้งเดียวตอนเข้า wizard (รวม refresh) ไม่ re-run ตอนสลับ step
 * แก้ race ที่ refresh แล้วเด้งกลับขั้น 1 + ฟอร์มไม่ถูกเติมข้อมูล
 */
export const loadDraftGuard: CanActivateFn = () =>
  inject(TaxWizardStore)
    .loadDraft()
    .pipe(map(() => true));

/**
 * กันเข้าขั้นที่ยังไม่ปลดล็อก — ถ้าไม่ผ่านให้ redirect กลับขั้นล่าสุดที่เข้าได้
 * UrlTree สร้างจาก snapshot ของ route ปัจจุบันแบบ relative เสมอ เพื่อคง prefix
 * ของโหมด embedded (`/income-tax/wizard/...`) ไว้ — ห้าม absolute `/wizard/...` (R6)
 */
export const canActivateStep =
  (step: WizardStep): CanActivateFn =>
  (route) => {
    const store = inject(TaxWizardStore);
    if (store.canAccess(step)) return true;
    const latest = [...WIZARD_STEPS].reverse().find((s) => store.canAccess(s)) ?? WIZARD_STEPS[0];
    return createUrlTreeFromSnapshot(route, ['..', latest]);
  };
