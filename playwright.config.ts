import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  // โหมด embedded ต้องโหลด remoteEntry ข้าม origin ตอนรันครั้งแรก — เผื่อเวลากว่า default
  expect: { timeout: 10_000 },
  use: { trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx ng serve personal-income-tax',
      url: 'http://localhost:4201',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: 'npx ng serve shell',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
