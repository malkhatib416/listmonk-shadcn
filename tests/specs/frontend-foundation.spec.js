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

test('the root URL redirects to the admin', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/admin$/);
});

test.describe('unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the root URL ends on the login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('redirects to login and does not serve the shell', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsettings%2Flogs/);
  });
});

test.describe('bundled assets', () => {
  test('the shell links the bundled favicon, which Go serves', async ({ page }) => {
    await page.goto('/admin');
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBe('/admin/app/favicon.png');
    expect((await page.request.get(href)).status()).toBe(200);
  });

  test('the email builder bundle is served for the visual editor', async ({ page }) => {
    const res = await page.request.get('/admin/app/email-builder/email-builder.umd.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);
  });
});
