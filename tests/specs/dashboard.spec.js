import { test, expect } from '@playwright/test';
import { resetDB } from '../helpers.js';

const DASHBOARD = '/admin';

test.beforeEach(async ({ browser }) => {
  await resetDB(browser);
});

async function counts(page) {
  return (await (await page.request.get('/api/dashboard/counts')).json()).data;
}

test('shows the counts the API reports', async ({ page }) => {
  const c = await counts(page);
  await page.goto(DASHBOARD);
  for (const [id, total] of [
    ['lists', c.lists.total],
    ['subscribers', c.subscribers.total],
    ['campaigns', c.campaigns.total],
    ['messages', c.messages],
  ]) {
    await expect(page.getByTestId(id).getByTestId('stat-value')).toHaveText(total.toLocaleString());
  }
});

test('breakdown numbers link to the filtered pages', async ({ page }) => {
  await page.goto(DASHBOARD);
  await page.getByTestId('lists').getByRole('link', { name: /^\d+$/ }).nth(1).click();
  await expect(page).toHaveURL(/\/admin\/lists\?type=public$/);
  await page.goto(DASHBOARD);
  await page.getByTestId('subscribers').getByRole('link', { name: /^\d+$/ }).nth(1).click();
  await expect(page).toHaveURL(/\/admin\/subscribers\?subscription_status=none$/);
  await page.goto(DASHBOARD);
  await page.getByTestId('campaigns').getByRole('link', { name: /^\d+$/ }).nth(1).click();
  await expect(page).toHaveURL(/\/admin\/campaigns\?status=scheduled$/);
});

test('lists recent campaigns with their status and links to them', async ({ page }) => {
  const [camp] = (await (await page.request.get('/api/campaigns')).json()).data.results;
  await page.goto(DASHBOARD);
  const recent = page.getByTestId('recent-campaigns');
  await expect(recent).toContainText(camp.name);
  await expect(recent).toContainText('Draft');
  await recent.getByRole('link', { name: camp.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/campaigns/${camp.id}$`));
});

test('shows system stats and the chart cards', async ({ page }) => {
  await page.goto(DASHBOARD);
  await expect(page.getByTestId('system')).toContainText('Uptime');
  await expect(page.getByTestId('system')).toContainText('CPU cores');
  await expect(page.getByRole('heading', { name: 'Campaign views' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Link clicks' })).toBeVisible();
});

test('the sidebar marks the dashboard active', async ({ page }) => {
  await page.goto(DASHBOARD);
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toHaveAttribute('data-active', 'true');
});
