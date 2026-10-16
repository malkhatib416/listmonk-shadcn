import { test, expect } from '@playwright/test';

const PAGE = '/admin/settings/logs';

test.describe('Logs', () => {
  test('shows the log lines', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
    await expect(page.getByRole('log')).toContainText('reading config');
  });

  test('the sidebar navigates between pages without reloading', async ({ page }) => {
    await page.goto(PAGE);
    await page.evaluate(() => { window.__spa = true; });
    await page.getByRole('button', { name: 'Lists' }).click();
    await page.getByRole('link', { name: 'All lists' }).click();
    await expect(page).toHaveURL(/\/admin\/lists$/);
    await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible();
    // Still the same document: client-side navigation.
    expect(await page.evaluate(() => window.__spa)).toBe(true);
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

test.describe('Logs: layout', () => {
  test('the sidebar collapses fully and reopens, so no group is stranded', async ({ page }) => {
    await page.goto(PAGE);
    const dashboard = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboard).toBeVisible();

    // The header button; the sidebar rail has the same accessible name.
    const trigger = page.locator('[data-sidebar="trigger"]');
    await trigger.click();
    // Collapsed means off-screen, not an icon rail with unreachable groups.
    await expect(dashboard).not.toBeInViewport();

    await trigger.click();
    await expect(dashboard).toBeInViewport();
  });
});

test.describe('Logs: global notices', () => {
  test('shows the restart, update and upstream message banners from the server config', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.data.needs_restart = true;
      body.data.update = {
        update: { is_new: true, release_version: 'v99.0.0', release_date: '2026-01-02', url: 'https://example.com/r' },
        messages: [{ title: 'Heads up', description: 'Maintenance soon', url: '', priority: 'high' }],
      };
      await route.fulfill({ response: res, json: body });
    });
    await page.goto(PAGE);

    await expect(page.locator('[data-cy=needs-restart]')).toContainText('restart');
    await expect(page.locator('[data-cy=needs-restart]').getByRole('button', { name: 'Restart' })).toBeVisible();
    await expect(page.locator('[data-cy=update-available]')).toContainText('v99.0.0 (02 Jan 2026)');
    await expect(page.locator('[data-cy=update-message]')).toContainText('Heads up');
  });

  test('no banners when the server has nothing to say', async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
    await expect(page.locator('[data-cy=needs-restart]')).toHaveCount(0);
  });
});

test.describe('Logs: failure and permission handling', () => {
  test('an expired session sends the user to login with next', async ({ page, context }) => {
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
    await context.clearCookies();
    // Refetch on tab focus, instead of waiting for the 10s poll.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })));
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsettings%2Flogs/);
  });

  test('a failed bootstrap shows an error with Retry, not a blank page', async ({ page }) => {
    await page.route('**/api/config', (route) =>
      route.fulfill({ status: 500, json: { message: 'boom' } }),
    );
    await page.goto(PAGE);
    await expect(page.getByText('Could not load listmonk')).toBeVisible();
    await expect(page.getByText('boom')).toBeVisible();

    await page.unroute('**/api/config');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible();
  });

  async function apiUserContext(browser, page, permissions) {
    const data = async (res) => {
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).data;
    };
    const stamp = Date.now();
    const role = await data(await page.request.post('/api/roles/users', { data: {
      name: `logs-role-${stamp}`, permissions,
    } }));
    const user = await data(await page.request.post('/api/users', { data: {
      username: `logs-user-${stamp}`, type: 'api', status: 'enabled', user_role_id: role.id,
    } }));
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: {
        Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}`,
      },
    });
    const cleanup = async () => {
      await context.close();
      await page.request.delete(`/api/users/${user.id}`);
      await page.request.delete(`/api/roles/${role.id}`);
    };
    return { context, cleanup };
  }

  test('a user without settings:get gets the permission error page, not the app', async ({ browser, page }) => {
    const { context, cleanup } = await apiUserContext(browser, page, ['bounces:get']);
    try {
      const res = await context.request.get(PAGE);
      expect(res.status()).toBe(403);
      const body = await res.text();
      expect(body).not.toContain('/admin/app/assets');
      // The plain message page names what was denied.
      expect(body).toContain('/admin/settings/logs');
    } finally {
      await cleanup();
    }
  });

  test('the sidebar only shows what the user may use', async ({ browser, page }) => {
    const { context, cleanup } = await apiUserContext(browser, page, ['settings:get']);
    try {
      const p = await context.newPage();
      await p.goto(PAGE);
      await expect(p.getByRole('heading', { name: 'Logs' })).toBeVisible();
      for (const hidden of ['Subscribers', 'Campaigns', 'Users']) {
        await expect(p.getByRole('button', { name: hidden, exact: true })).toHaveCount(0);
      }
      await expect(p.getByRole('link', { name: 'Logs' })).toBeVisible();
      await expect(p.getByRole('link', { name: 'Maintenance' })).toHaveCount(0);
    } finally {
      await cleanup();
    }
  });
});
