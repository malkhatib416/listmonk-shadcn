import { test, expect } from '@playwright/test';

const PAGE = '/admin/settings/logs';

test.describe('new admin frontend foundation', () => {
  test('renders and persists the dark theme across reload', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();

    await page.getByRole('button', { name: 'admin', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('stored dark theme is applied before first paint', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    // Block the app bundle so only the inline <head> script can have run.
    await page.route('**/admin/app/assets/**', (route) => route.abort());
    await page.goto(PAGE);
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  });

  test('system theme follows the OS preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(PAGE);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to login and does not serve the shell', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsettings%2Flogs/);
  });
});
