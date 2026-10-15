import { test, expect } from '@playwright/test';

test.describe('Profile', () => {
  test('updates the name and shows the role', async ({ page }) => {
    await page.goto('/admin/user/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Super Admin')).toBeVisible();

    await page.locator('input[name=name]').fill('Renamed Admin');
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/profile') && r.request().method() === 'PUT'),
      page.locator('[data-cy=btn-save]').click(),
    ]);
    const me = (await (await page.request.get('/api/profile')).json()).data;
    expect(me.name).toBe('Renamed Admin');

    // The sidebar picks the new name up without a reload.
    await expect(page.getByRole('button', { name: 'Renamed Admin' })).toBeVisible();
  });

  test('refuses mismatched or short passwords without calling the API', async ({ page }) => {
    let puts = 0;
    page.on('request', (r) => r.url().endsWith('/api/profile') && r.method() === 'PUT' && (puts += 1));
    await page.goto('/admin/user/profile');
    await page.locator('input[name=password]').fill('longenough1');
    await page.locator('input[name=password2]').fill('different');
    await page.locator('[data-cy=btn-save]').click();
    await expect(page.locator('[data-slot=form-message]')).not.toHaveCount(0);
    await page.locator('input[name=password]').fill('short');
    await page.locator('input[name=password2]').fill('short');
    await page.locator('[data-cy=btn-save]').click();
    await expect(page.locator('[data-slot=form-message]')).not.toHaveCount(0);
    expect(puts).toBe(0);
  });

  test('offers two-factor setup with a QR code', async ({ page }) => {
    await page.goto('/admin/user/profile');
    await page.getByRole('switch', { name: 'Two-factor authentication' }).click();
    await expect(page.getByAltText('QR code')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /code/i })).toBeVisible();
  });
});

test.describe('Maintenance', () => {
  test('every delete asks for confirmation naming what goes', async ({ page }) => {
    await page.goto('/admin/settings/maintenance');
    await page.locator('[data-cy=btn-delete-analytics]').click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('All');
    await expect(dialog).toContainText('Older than');
    // Cancelling must not call the API.
    let called = false;
    page.on('request', (r) => r.method() === 'DELETE' && (called = true));
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(called).toBe(false);
  });

  test('the export link carries the chosen date', async ({ page }) => {
    await page.goto('/admin/settings/maintenance');
    await page.locator('input[type=date]').nth(2).fill('2026-01-02');
    await expect(page.locator('[data-cy=btn-export-analytics]')).toHaveAttribute(
      'href',
      /\/api\/maintenance\/analytics\/views\/export\?since=2026-01-02T00%3A00%3A00\.000Z/,
    );
  });

  test('saves the vacuum settings', async ({ page }) => {
    await page.goto('/admin/settings/maintenance');
    await page.getByRole('switch', { name: 'Enabled' }).click();
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/settings/maintenance.db') && r.request().method() === 'PUT'),
      page.locator('[data-cy=btn-save-db]').click(),
    ]);
    // The app restarts; wait for it, then the saved value is shown.
    await expect(async () => {
      expect((await page.request.get('/api/maintenance/db')).ok()).toBe(true);
    }).toPass({ timeout: 20000 });
    const db = (await (await page.request.get('/api/maintenance/db')).json()).data;
    expect(db.vacuum).toBe(true);
  });
});
