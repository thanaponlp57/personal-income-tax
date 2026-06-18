import { expect, Page, test } from '@playwright/test';

// backlog phase 2 ข้อ 6: เดินครบ 5 ขั้นทั้งโหมด standalone (:4201) และ embedded ใน shell (:4200)
const MODES = [
  { name: 'standalone', base: 'http://localhost:4201' },
  { name: 'embedded', base: 'http://localhost:4200/income-tax' },
] as const;

const calcRow = (page: Page, label: string) => page.locator('#calcTable tr', { hasText: label });

for (const mode of MODES) {
  test.describe(`โหมด ${mode.name}`, () => {
    test('เดินครบ 5 ขั้น golden case (600,000 โสด) → ชำระเพิ่ม 21,500 บาท', async ({ page }) => {
      await page.goto(mode.base);
      await page.getByRole('link', { name: /เริ่มกรอกแบบ ภ\.ง\.ด\.91/ }).click();
      await expect(page).toHaveURL(/\/wizard\/taxpayer$/);

      // ขั้น 1 — ผู้มีเงินได้ (พิมพ์เลขดิบ 13 หลัก → จัด format มีขีดให้เอง UX-07)
      await page.locator('#firstName').fill('สมชาย');
      await page.locator('#lastName').fill('ใจดี');
      await page.locator('#taxId').fill('1234567890123');
      await expect(page.locator('#taxId')).toHaveValue('1-2345-67890-12-3');
      await page.getByRole('button', { name: /ถัดไป/ }).click();
      await expect(page).toHaveURL(/\/wizard\/income$/);

      // ขั้น 2 — เงินได้ (คั่นหลักพันสด UX-06 + preview ค่าใช้จ่าย)
      await page.locator('#salary').fill('600000');
      await expect(page.locator('#salary')).toHaveValue('600,000');
      await expect(page.locator('#incomePreview')).toContainText('100,000');
      await page.getByRole('button', { name: /ถัดไป/ }).click();
      await expect(page).toHaveURL(/\/wizard\/deductions$/);

      // ขั้น 3 — ค่าลดหย่อน (ไม่กรอกอะไร → เหลือลดหย่อนส่วนตัวอัตโนมัติ)
      await expect(page.locator('#allowTotal')).toHaveText('60,000');
      await page.getByRole('button', { name: /ถัดไป/ }).click();
      await expect(page).toHaveURL(/\/wizard\/review$/);

      // ขั้น 4 — ตรวจสอบ
      await expect(calcRow(page, 'เงินได้สุทธิ')).toContainText('440,000');
      await expect(calcRow(page, 'ภาษีที่คำนวณได้')).toContainText('21,500');
      await expect(page.locator('#bracketTable tbody tr')).toHaveCount(3);
      await page.getByRole('button', { name: /ยืนยันการคำนวณ/ }).click();
      await expect(page).toHaveURL(/\/wizard\/result$/);

      // ขั้น 5 — สรุปผล (หัก ณ ที่จ่าย 0 → ชำระเพิ่มเต็มจำนวน)
      await expect(page.locator('#resultCard')).toHaveClass(/alert-danger/);
      await expect(page.locator('#resultCard')).toContainText('มีภาษีต้องชำระเพิ่ม');
      await expect(page.locator('#resultCard')).toContainText('21,500 บาท');
    });

    test('deep link เข้าขั้นที่ล็อกอยู่ → guard เด้งกลับขั้นแรกใต้ base เดิม (R6)', async ({
      page,
    }) => {
      await page.goto(`${mode.base}/wizard/review`);
      await expect(page).toHaveURL(/\/wizard\/taxpayer$/);
      // ต้องไม่หลุดเป็น absolute /wizard — โหมด embedded ต้องคง prefix /income-tax
      expect(page.url()).toContain(mode.base);
    });
  });
}
