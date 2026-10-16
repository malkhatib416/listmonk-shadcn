import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

const data = async (res) => {
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).data;
};

test.describe.configure({ mode: 'serial' });

test.describe('Analytics', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('list analytics: shows the selected list with its charts', async ({ page }) => {
    await page.goto('/admin/lists/analytics?id=1');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByTestId('picked-items')).toContainText('Default list');
    await expect(page.getByRole('heading', { name: /Subscriptions/ })).toBeVisible();
  });

  test('picking another list and viewing puts both ids in the URL', async ({ page }) => {
    await page.goto('/admin/lists/analytics?id=1');
    await expect(page.getByTestId('picked-items')).toContainText('Default list');
    await page.getByTestId('item-picker').click();
    await page.getByTestId('item-option').filter({ hasText: 'Opt-in list' }).click();
    await page.keyboard.press('Escape');
    await page.locator('[data-cy=btn-search]').click();
    await expect(page).toHaveURL(/[?&]id=1&id=2|[?&]id=2&id=1/);
    await expect(page.getByTestId('picked-items')).toContainText('Opt-in list');
  });

  test('no list selected: the view button is disabled and nothing is charted', async ({ page }) => {
    await page.goto('/admin/lists/analytics');
    await expect(page.locator('[data-cy=btn-search]')).toBeDisabled();
    await expect(page.getByText('Nothing here')).toBeVisible();
  });

  test('the date range and interval are sent to the API', async ({ page }) => {
    await page.goto('/admin/lists/analytics?id=1');
    await page.locator('[data-cy=from]').fill('2026-01-01T00:00');
    await page.locator('[data-cy=to]').fill('2026-01-31T00:00');
    await page.getByRole('combobox', { name: 'Interval' }).click();
    await page.getByRole('option', { name: 'Week' }).click();
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/analytics/lists')),
      page.locator('[data-cy=btn-search]').click(),
    ]);
    const q = new URL(req.url()).searchParams;
    expect(q.get('from')).toBe('2026-01-01T00:00');
    expect(q.get('to')).toBe('2026-01-31T00:00');
    expect(q.get('interval')).toBe('week');
  });

  test('campaign analytics needs the analytics permission', async ({ page, browser }) => {
    const campaign = await data(await page.request.post('/api/campaigns', { data: {
      name: 'Analytics campaign', subject: 's', type: 'regular', content_type: 'html', body: 'b', lists: [1],
    } }));
    await page.goto(`/admin/campaigns/analytics?id=${campaign.id}`);
    await expect(page.getByTestId('picked-items')).toContainText('Analytics campaign');
    await expect(page.getByRole('heading', { name: 'Links' })).toBeVisible();

    // A user without campaigns:get_analytics is refused by the API and the page.
    const role = await data(await page.request.post('/api/roles/users', { data: { name: 'no analytics', permissions: ['campaigns:get_all'] } }));
    const user = await data(await page.request.post('/api/users', { data: { username: 'no-analytics', type: 'api', status: 'enabled', user_role_id: role.id } }));
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}` },
    });
    try {
      expect((await context.request.get(`/api/analytics/campaigns?id=${campaign.id}`)).status()).toBe(403);
      expect((await context.request.get('/admin/campaigns/analytics')).status()).toBe(403);
      // Lists analytics only need list access.
      expect((await context.request.get('/api/analytics/lists?id=1')).status()).not.toBe(403);
    } finally {
      await context.close();
    }
  });

  test('rejects an unknown resource', async ({ page }) => {
    expect((await page.request.get('/api/analytics/nope?id=1')).status()).toBe(400);
  });
});
