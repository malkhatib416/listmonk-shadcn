import { test, expect } from '@playwright/test';
import { confirm, resetDB } from '../helpers.js';

const MEDIA = '/admin/campaigns/media';

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.configure({ mode: 'serial' });

test.describe('Media', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('starts empty', async ({ page }) => {
    await page.goto(MEDIA);
    await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible();
    await expect(page.locator('[data-cy=media-item]')).toHaveCount(0);
    await expect(page.getByText('Nothing here')).toBeVisible();
  });

  test('uploads images and lists them with thumbnails', async ({ page }) => {
    await page.goto(MEDIA);
    await page.getByTestId('file-input').setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: PNG },
      { name: 'two.png', mimeType: 'image/png', buffer: PNG },
    ]);
    await expect(page.locator('[data-cy=media-item]')).toHaveCount(2);
    await expect(page.locator('[data-cy=media-item]').first().locator('img')).toBeVisible();
    // The files are served from the uploads URL.
    const href = await page.locator('[data-cy=media-item] a').first().getAttribute('href');
    expect((await page.request.get(href)).ok()).toBe(true);
  });

  test('shows the server error for a failed upload and keeps the library intact', async ({ page }) => {
    await page.goto(MEDIA);
    await page.route('**/api/media', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 400, json: { message: 'Unsupported file type (exe)' } })
        : route.continue(),
    );
    await page.getByTestId('file-input').setInputFiles([
      { name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') },
    ]);
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'bad.exe: Unsupported file type' })).toBeVisible();
    await expect(page.locator('[data-cy=media-item]')).toHaveCount(2);
  });

  test('searches by file name', async ({ page }) => {
    await page.goto(MEDIA);
    await page.locator('[data-cy=query]').fill('two');
    await expect(page.locator('[data-cy=media-item]')).toHaveCount(1);
    await expect(page.locator('[data-cy=media-item]')).toContainText('two.png');
  });

  test('deletes a file after confirming', async ({ page }) => {
    await page.goto(MEDIA);
    const item = page.locator('[data-cy=media-item]').filter({ hasText: 'one.png' });
    await item.hover();
    await item.getByRole('button', { name: 'More' }).click();
    await page.locator('[data-cy=btn-delete]').click();
    await confirm(page);
    await expect(page.locator('[data-cy=media-item]')).toHaveCount(1);
    await expect(page.locator('[data-cy=media-item]')).toContainText('two.png');
  });
});
