import { test, expect } from '@playwright/test';

const PAGE = '/admin/settings/logs';

test.describe('Logs', () => {
  test('shows the log lines', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
    await expect(page.getByRole('log')).toContainText('reading config');
  });

  test('sidebar lists Logs and links unported pages to the old admin', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Lists' }).click();
    await page.getByRole('link', { name: 'All lists' }).click();
    await expect(page).toHaveURL(/\/admin\/lists$/);
    // Full page load: the old admin renders its own markup, not the SPA shell.
    await expect(page.locator('h1.page-title')).toBeVisible();
    await expect(page.getByRole('log')).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark']) {
    test(`loads without console errors in ${scheme}`, async ({ page }) => {
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PAGE);
      await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
      await expect(page.locator('html')).toHaveClass(scheme === 'dark' ? /dark/ : /^((?!dark).)*$/);
      expect(errors).toEqual([]);
    });
  }

  test('mobile: the sidebar opens as a sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});
