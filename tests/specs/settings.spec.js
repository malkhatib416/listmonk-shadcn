import { test, expect } from '@playwright/test';
import { resetDB, getMail, confirm } from '../helpers.js';

const SETTINGS = '/admin/settings';
const smtpServers = (page) => page.getByTestId('smtp-server');
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const saveButton = (page) => page.getByRole('button', { name: 'Save', exact: true });

async function settings(page) {
  const res = await page.request.get('/api/settings');
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

// Saving reloads the backend. Wait for the UI's health check before moving on.
async function save(page, status = 200) {
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/settings'
    && r.request().method() === 'PUT');
  await saveButton(page).click();
  expect((await response).status()).toBe(status);
  if (status === 200) {
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByText('"Settings" updated', { exact: true })).toBeVisible();
  }
  await expect(saveButton(page)).toBeEnabled();
}

// Switch a (Radix) switch to the wanted state.
async function setSwitch(locator, on) {
  if ((await locator.getAttribute('aria-checked') === 'true') !== on) await locator.click();
  await expect(locator).toHaveAttribute('aria-checked', String(on));
}

// Pick an option of a (Radix) select found by its role and name inside `scope`.
async function pick(page, combobox, option) {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const authSelect = (server) => server.getByRole('group', { name: 'Auth protocol', exact: true }).getByRole('combobox');
const tlsSelect = (server) => server.getByRole('group', { name: 'TLS', exact: true }).getByRole('combobox');

async function remove(page, item, accept = true) {
  await item.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: accept ? 'Ok' : 'Cancel', exact: true }).click();
}

test.describe('Settings', () => {
  // Reset before creating the page/context so it uses the refreshed login.
  test.beforeEach(async ({ browser }) => { await resetDB(browser); });
  test.beforeEach(async ({ page }) => { await page.goto(SETTINGS); });

  test('saves edits across tabs, enables SMTP and deletes a server', async ({ page }) => {
    const root = 'http://127.0.0.1:9000';
    const favicon = `${root}/public/static/logo.png`;
    await page.locator('[name="app.root_url"]').fill(root);
    await page.locator('[name="app.favicon_url"]').fill(favicon);
    await tab(page, 'Performance').click();
    await page.locator('[name="app.concurrency"]').fill('9');
    await tab(page, 'SMTP').click();
    await page.getByRole('button', { name: 'Add new' }).click();
    const servers = smtpServers(page);
    const added = servers.nth(1);
    await added.getByPlaceholder('smtp.yourmailserver.net').fill('localhost');
    await added.getByRole('spinbutton', { name: /^Port/ }).fill('1025');
    await pick(page, tlsSelect(added), 'Off');
    const enabled = added.getByRole('switch', { name: 'Enabled', exact: true });
    await setSwitch(enabled, false);
    await expect(added.getByPlaceholder('smtp.yourmailserver.net')).toBeDisabled();
    await expect(added.getByRole('button', { name: 'Test connection' })).toBeDisabled();
    await setSwitch(enabled, true);
    await remove(page, servers.first(), false);
    await expect(servers).toHaveCount(2);
    await remove(page, servers.first());
    await expect(servers).toHaveCount(1);
    await expect(servers.getByRole('button', { name: 'Delete' })).toBeHidden();
    await save(page);
    expect(await settings(page)).toMatchObject({
      'app.root_url': root, 'app.favicon_url': favicon, 'app.concurrency': 9,
      smtp: [{ enabled: true, host: 'localhost', port: 1025, tls_type: 'none' }],
    });
    await page.reload();
    await tab(page, 'SMTP').click();
    await expect(servers.getByRole('switch', { name: 'Enabled', exact: true })).toHaveAttribute('aria-checked', 'true');
    await tab(page, 'General').click();
    await expect(page.locator('[name="app.root_url"]')).toHaveValue(root);
    await expect(page.locator('[name="app.favicon_url"]')).toHaveValue(favicon);
    await tab(page, 'Performance').click();
    await expect(page.locator('[name="app.concurrency"]')).toHaveValue('9');
  });

  test('searches across tabs using all terms', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: 'Search' });
    await search.fill('  RATE   workers  ');
    await expect(page.locator('[name="app.concurrency"]')).toBeVisible();
    await expect(tab(page, 'General')).toBeHidden();
    await expect(tab(page, 'Performance')).toBeVisible();
    await search.fill('email');
    await expect(page.locator('[name="app.from_email"]')).toBeVisible();
    await expect(tab(page, 'SMTP')).toBeVisible();
    await tab(page, 'SMTP').click();
    await expect(search).toBeEmpty();
    await expect(smtpServers(page)).toBeVisible();
    await search.fill('no-such-setting');
    await expect(tab(page, 'General')).toBeVisible();
    await expect(smtpServers(page)).toBeVisible();
    await search.fill('concurrency');
    await search.fill('');
    await expect(smtpServers(page)).toBeVisible();
    await expect(page.locator('[name="app.concurrency"]')).toBeHidden();
  });

  test('SMTP presets reset credentials and preserve unrelated fields and accordion state', async ({ page }) => {
    await tab(page, 'SMTP').click();
    const server = smtpServers(page);
    await server.getByTestId('box-toggle').click();
    await server.getByPlaceholder('email-primary').fill('email-primary');
    await pick(page, authSelect(server), 'LOGIN');
    await server.getByRole('textbox', { name: /^Username/ }).fill('old-user');
    await server.getByLabel(/Password/).fill('old-secret');
    for (const [provider, host, port, auth, tls] of [
      ['Gmail', 'smtp.gmail.com', '465', 'LOGIN', 'SSL/TLS'],
      ['Postmark', 'smtp.postmarkapp.com', '587', 'CRAM', 'STARTTLS'],
    ]) {
      await server.getByRole('button', { name: provider, exact: true }).click();
      await expect(server.getByPlaceholder('smtp.yourmailserver.net')).toHaveValue(host);
      await expect(server.getByRole('spinbutton', { name: /^Port/ })).toHaveValue(port);
      await expect(authSelect(server)).toHaveText(auth);
      await expect(tlsSelect(server)).toHaveText(tls);
      await expect(server.getByRole('textbox', { name: /^Username/ })).toBeFocused();
      await expect(server.getByRole('textbox', { name: /^Username/ })).toBeEmpty();
      await expect(server.getByLabel(/Password/)).toBeEmpty();
      await expect(server.getByPlaceholder('email-primary')).toHaveValue('email-primary');
    }
    await pick(page, authSelect(server), 'None');
    await expect(server.getByRole('textbox', { name: /^Username/ })).toBeDisabled();
    await expect(server.getByLabel(/Password/)).toBeDisabled();
    await page.reload();
    await expect(server.getByPlaceholder('smtp.yourmailserver.net')).toBeVisible();
    await server.getByTestId('box-toggle').click();
    await page.reload();
    await expect(server).toBeVisible();
    await expect(server.getByPlaceholder('smtp.yourmailserver.net')).toBeHidden();
  });

  test('tests custom SMTP headers and masks saved secrets', async ({ page }) => {
    await tab(page, 'SMTP').click();
    const server = smtpServers(page);
    await server.getByTestId('box-toggle').click();
    await pick(page, authSelect(server), 'LOGIN');
    await server.getByRole('textbox', { name: /^Username/ }).fill('test-user');
    await server.getByLabel(/Password/).fill('settings-test-secret');
    await server.getByRole('button', { name: 'Set custom headers' }).click();
    const headers = server.getByPlaceholder('[{"X-Custom": "value"}]');
    await headers.fill('[{"X-Settings-Test":"saved"}]');
    await save(page);
    await page.reload();
    await expect(server.getByLabel(/Password/)).toHaveValue(/^•+$/);
    expect(JSON.parse(await headers.inputValue())).toEqual([{ 'X-Settings-Test': 'saved' }]);
    await server.getByLabel(/Password/).fill('••partial');
    await saveButton(page).click();
    await expect(page.getByText(/Clear and re-enter the full password/)).toBeVisible();
    await server.getByLabel(/Password/).fill('replacement-secret');
    await save(page);
    await page.reload();
    await expect(server.getByLabel(/Password/)).toHaveValue(/^•+$/);
    // An unrelated save sends no replacement for the masked password.
    const request = page.waitForRequest((r) => r.url().endsWith('/api/settings') && r.method() === 'PUT');
    await save(page);
    expect((await request).postDataJSON().smtp[0].password).toBe('');
    await page.reload();
    await expect(server.getByLabel(/Password/)).toHaveValue(/^•+$/);
  });

  test('tests the SMTP connection with the typed settings', async ({ page }) => {
    await tab(page, 'SMTP').click();
    const server = smtpServers(page);
    await server.getByTestId('box-toggle').click();
    await server.getByTestId('btn-test-smtp').click();
    await server.getByPlaceholder('email@site.com').fill('someone@example.com');
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/settings/smtp/test')),
      server.getByRole('button', { name: 'Send e-mail' }).click(),
    ]);
    expect(res.request().postDataJSON()).toMatchObject({ email: 'someone@example.com' });
    expect(res.ok()).toBeTruthy();
    await expect.poll(async () => (await getMail()).length).toBeGreaterThan(0);
  });

  test('normalizes domain lists and retains tracking preferences while disabled', async ({ page }) => {
    await tab(page, 'Privacy').click();
    const individual = page.getByRole('switch', { name: /^Individual subscriber tracking/ });
    await setSwitch(individual, true);
    await setSwitch(page.getByRole('switch', { name: /^Disable tracking/ }), true);
    await expect(individual).toBeDisabled();
    await expect(individual).toHaveAttribute('aria-checked', 'true');
    const domainText = page.locator('textarea:visible');
    await domainText.fill('  EXAMPLE.COM  \n\n spam.test\n  ');
    await expect(page.getByRole('tab', { name: /Domain blocklist \(\s*2\s*\)/ })).toBeVisible();
    await page.getByRole('tab', { name: /^Domain allowlist/ }).click();
    await domainText.fill(' TRUSTED.TEST \n\n');
    await save(page);
    expect(await settings(page)).toMatchObject({
      'privacy.domain_blocklist': ['example.com', 'spam.test'],
      'privacy.domain_allowlist': ['trusted.test'],
      'privacy.disable_tracking': true, 'privacy.individual_tracking': true,
    });
    await page.reload();
    await expect(domainText).toHaveValue('example.com\nspam.test');
    await setSwitch(page.getByRole('switch', { name: /^Disable tracking/ }), false);
    await expect(individual).toBeEnabled();
    await expect(individual).toHaveAttribute('aria-checked', 'true');
  });

  test('enables sliding window controls and persists their values', async ({ page }) => {
    await tab(page, 'Performance').click();
    const group = page.getByRole('group', { name: 'Enable sliding window limit', exact: true });
    await expect(group.getByRole('textbox', { name: /^Duration/ })).toBeDisabled();
    await setSwitch(group.getByRole('switch'), true);
    await group.getByRole('spinbutton', { name: /^Max. messages/ }).fill('42');
    await group.getByRole('textbox', { name: /^Duration/ }).fill('2h');
    await save(page);
    await page.reload();
    await expect(group.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await expect(group.getByRole('spinbutton', { name: /^Max. messages/ })).toHaveValue('42');
    await expect(group.getByRole('textbox', { name: /^Duration/ })).toHaveValue('2h');
    await setSwitch(group.getByRole('switch'), false);
    await expect(group.getByRole('textbox', { name: /^Duration/ })).toBeDisabled();
    await expect(group.getByRole('textbox', { name: /^Duration/ })).toHaveValue('2h');
  });

  test('adds, disables and deletes messengers with confirmation', async ({ page }) => {
    await tab(page, 'Messengers').click();
    await page.getByRole('button', { name: 'Add new' }).click();
    const messenger = page.getByTestId('messenger');
    await expect(messenger.getByPlaceholder('mymessenger')).toBeFocused();
    await messenger.getByPlaceholder('mymessenger').fill('sms-test');
    await messenger.getByPlaceholder('https://postback.messenger.net/path').fill('http://localhost:9999/send');
    await setSwitch(messenger.getByRole('switch', { name: 'Enabled' }), false);
    await save(page);
    await page.reload();
    await expect(messenger).toHaveCount(1);
    await expect(messenger.getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'false');
    expect((await settings(page)).messengers).toMatchObject([
      { name: 'sms-test', root_url: 'http://localhost:9999/send', enabled: false },
    ]);
    await remove(page, messenger, false);
    await expect(messenger).toHaveCount(1);
    await remove(page, messenger);
    await expect(messenger).toHaveCount(0);
    await save(page);
    await page.reload();
    await expect(messenger).toHaveCount(0);
    expect((await settings(page)).messengers).toEqual([]);
  });

  test('persists trusted URLs as separate entries', async ({ page }) => {
    await tab(page, 'Security').click();
    const urls = page.getByPlaceholder('https://example.com', { exact: true });
    await urls.fill('https://one.example.com\nhttps://two.example.com/thanks');
    await save(page);
    expect((await settings(page))['security.trusted_urls']).toEqual([
      'https://one.example.com', 'https://two.example.com/thanks',
    ]);
    await page.reload();
    await expect(urls).toHaveValue('https://one.example.com\nhttps://two.example.com/thanks');
    await urls.fill('');
    await save(page);
    await page.reload();
    await expect(urls).toBeEmpty();
  });

  test('persists the captcha provider and its key', async ({ page }) => {
    await tab(page, 'Security').click();
    const captcha = page.getByRole('group', { name: 'CAPTCHA', exact: true });
    await setSwitch(captcha.getByRole('switch'), true);
    await captcha.getByRole('radio', { name: /hCaptcha/ }).click();
    await captcha.getByLabel('hCaptcha.com SiteKey').fill('site-key');
    await save(page);
    expect((await settings(page))['security.captcha']).toMatchObject({
      altcha: { enabled: false }, hcaptcha: { enabled: true, key: 'site-key' },
    });
    await page.reload();
    await expect(captcha.getByRole('radio', { name: /hCaptcha/ })).toBeChecked();
    await expect(captcha.getByLabel('hCaptcha.com SiteKey')).toHaveValue('site-key');
  });

  test('OIDC fields and role mappings appear only when enabled and mappings can be removed', async ({ page }) => {
    await tab(page, 'Security').click();
    const oidc = page.getByRole('group', { name: 'OIDC SSO', exact: true });
    await expect(oidc.getByLabel('Provider URL', { exact: false })).toHaveCount(0);
    await setSwitch(oidc.getByRole('switch').first(), true);
    await oidc.getByRole('button', { name: 'Google', exact: true }).click();
    await expect(oidc.locator('input[type=url]')).toHaveValue('https://accounts.google.com');
    await expect(oidc.locator('input[readonly]')).toHaveValue(/\/auth\/oidc$/);
    // Role mappings are only editable while users are auto-created.
    const add = oidc.getByRole('button', { name: 'Add new', exact: true });
    await expect(add).toBeDisabled();
    await setSwitch(oidc.getByRole('switch').nth(1), true);
    await add.click();
    await expect(oidc.getByPlaceholder('groups')).toBeVisible();
    await oidc.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(oidc.getByPlaceholder('groups')).toHaveCount(0);
  });

  test('persists bounce actions and gates mailbox and webhook controls', async ({ page }) => {
    await tab(page, 'Bounces').click();
    await setSwitch(page.getByRole('switch', { name: 'Enable bounce processing', exact: true }), true);
    const hard = page.getByRole('group', { name: 'Hard', exact: true });
    await hard.getByRole('spinbutton').fill('3');
    await pick(page, hard.getByRole('combobox'), 'Unsubscribe');
    const mailbox = page.getByRole('switch', { name: 'Enable bounce mailbox', exact: true });
    await setSwitch(mailbox, true);
    await expect(page.getByPlaceholder('bounce.yourmailserver.net')).toBeVisible();
    await setSwitch(mailbox, false);
    await expect(page.getByPlaceholder('bounce.yourmailserver.net')).toHaveCount(0);
    const webhooks = page.getByRole('switch', { name: /^Enable bounce webhooks/ });
    await setSwitch(webhooks, true);
    await setSwitch(page.getByRole('group', { name: 'SES', exact: true }).getByRole('switch'), true);
    await save(page);
    expect(await settings(page)).toMatchObject({
      'bounce.enabled': true, 'bounce.webhooks_enabled': true, 'bounce.ses_enabled': true,
      'bounce.actions': { hard: { count: 3, action: 'unsubscribe' } },
      'bounce.mailboxes': [{ enabled: false }],
    });
    await page.reload();
    await expect(hard.getByRole('spinbutton')).toHaveValue('3');
    await expect(hard.getByRole('combobox')).toHaveText('Unsubscribe');
    await setSwitch(webhooks, false);
    await expect(page.getByRole('group', { name: 'SES', exact: true })).toHaveCount(0);
  });

  test('saves independent admin and public appearance editors', async ({ page }) => {
    await tab(page, 'Appearance').click();
    const css = page.getByRole('group', { name: 'Custom CSS', exact: true }).getByRole('textbox');
    const js = page.getByRole('group', { name: 'Custom JavaScript', exact: true }).getByRole('textbox');
    await css.fill('/* admin settings test */');
    await js.fill('// admin settings test');
    await tab(page, 'Public').click();
    await css.fill('/* public settings test */');
    await js.fill('// public settings test');
    await save(page);
    expect(await settings(page)).toMatchObject({
      'appearance.admin.custom_css': '/* admin settings test */',
      'appearance.admin.custom_js': '// admin settings test',
      'appearance.public.custom_css': '/* public settings test */',
      'appearance.public.custom_js': '// public settings test',
    });
    await page.reload();
    await expect(css).toHaveText('/* admin settings test */');
    await expect(js).toHaveText('// admin settings test');
    await tab(page, 'Public').click();
    await expect(css).toHaveText('/* public settings test */');
    await expect(js).toHaveText('// public settings test');
  });

  test('an invalid saved value is rejected without restarting', async ({ page }) => {
    await page.locator('[name="app.root_url"]').fill('not-a-url');
    const request = page.waitForRequest((r) => r.url().endsWith('/api/settings') && r.method() === 'PUT', { timeout: 1500 }).catch(() => null);
    await saveButton(page).click();
    // The browser blocks the submit: nothing is sent.
    expect(await request).toBeNull();
  });
});

test.describe('Maintenance: bulk deletion', () => {
  test.beforeEach(async ({ browser }) => { await resetDB(browser); });

  test('limits subscriber cleanup to its selected type and subscription cleanup to its cutoff', async ({ page }) => {
    const data = async (res) => {
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).data;
    };
    const original = (await data(await page.request.get('/api/subscribers'))).results;
    const blocked = await data(await page.request.post('/api/subscribers', { data: {
      email: 'blocked@example.com', name: 'Blocked', status: 'blocklisted', lists: [1],
    } }));
    const orphan = await data(await page.request.post('/api/subscribers', { data: {
      email: 'orphan@example.com', name: 'Orphan', status: 'enabled', lists: [],
    } }));
    await page.goto('/admin/settings/maintenance');
    const labels = { blocklisted: 'Blocklisted', orphan: 'Orphans' };
    for (const type of ['blocklisted', 'orphan']) {
      await page.getByRole('combobox', { name: 'Data' }).first().click();
      await page.getByRole('option', { name: labels[type], exact: true }).click();
      await page.locator('[data-cy=btn-delete-subscribers]').click();
      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(`/api/maintenance/subscribers/${type}`)), confirm(page),
      ]);
      expect(res.ok()).toBeTruthy();
      const remaining = (await data(await page.request.get('/api/subscribers'))).results;
      expect(remaining.some((s) => s.id === blocked.id)).toBe(false);
      expect(remaining.some((s) => s.id === orphan.id)).toBe(type !== 'orphan');
      expect(remaining.filter((s) => original.some((o) => o.id === s.id))).toEqual(original);
    }
    expect((await page.request.delete('/api/maintenance/subscriptions/unconfirmed?before_date=invalid')).status()).toBe(400);
    await data(await page.request.delete('/api/maintenance/subscriptions/unconfirmed?before_date=1970-01-01T00:00:00Z'));
    expect((await data(await page.request.get('/api/subscribers'))).results).toEqual(original);
    const future = new Date(Date.now() + 86400000).toISOString();
    await data(await page.request.delete(`/api/maintenance/subscriptions/unconfirmed?before_date=${encodeURIComponent(future)}`));
    const remaining = (await data(await page.request.get('/api/subscribers'))).results;
    expect(remaining.map((s) => s.id)).toEqual(original.map((s) => s.id));
    for (const sub of remaining) {
      const before = original.find((s) => s.id === sub.id);
      expect(sub.lists.map((l) => l.id)).toEqual(before.lists.filter((l) => !(l.optin === 'double' && l.subscription_status === 'unconfirmed')).map((l) => l.id));
    }
  });
});
