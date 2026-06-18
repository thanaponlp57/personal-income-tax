import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { TaxApiService } from './tax-api.service';

/**
 * No-op TaxApiService สำหรับ spec ที่ขับ TaxWizardStore แต่ไม่ต้องการ HTTP จริง
 * (store auto-save draft ทุกครั้งที่ save<Step> — ดู task-06) คืน observable ว่าง ๆ
 */
export const provideTaxApiMock = (): Provider => ({
  provide: TaxApiService,
  useValue: {
    getDraft: () => of(null),
    saveDraft: () => of(undefined),
    deleteDraft: () => of(undefined),
  },
});
