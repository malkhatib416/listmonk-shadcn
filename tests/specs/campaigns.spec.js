import { test, expect } from '@playwright/test';
import { confirm, openMenu, resetDB, getMail } from '../helpers.js';

const CAMPAIGNS = '/admin/campaigns';
const expression = 'Hello {{ .Subscriber.Name }} from {{ .Subscriber.Attribs.city }}';
const rendered = 'Hello Demo Subscriber from Bengaluru';
const rows = (page) => page.getByTestId('campaign-row');
const row = (page, name) => rows(page).filter({ has: page.getByRole('link', { name, exact: true }) });
const tab = (page, name) => page.getByRole('tab', { name });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const previewFrame = (page) => page.frameLocator('[role=dialog] iframe');

async function data(response) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).data;
}

async function create(page, overrides = {}) {
  return data(await page.request.post('/api/campaigns', { data: {
    name: 'Campaign', subject: 'Campaign subject', type: 'regular',
    content_type: 'html', body: `<p>${expression}</p>`, lists: [1], ...overrides,
  } }));
}

async function campaign(page, id) {
  return data(await page.request.get(`/api/campaigns/${id}`));
}

async function save(page, id, action = () => page.getByTestId('btn-save').click()) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/api/campaigns/${id}`) && r.request().method() === 'PUT'),
    action(),
  ]);
  return data(response);
}

async function menu(page, name, testId) {
  await openMenu(row(page, name));
  await page.getByTestId(testId).click();
}

// Pick a Radix select option by the trigger's test id.
async function choose(page, testId, name) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name, exact: true }).click();
}

// Pick lists in the list picker (a searchable multi-select popover).
async function pickList(page, name) {
  await page.getByTestId('list-picker').click();
  await page.getByTestId('list-option').filter({ hasText: name }).click();
  await page.keyboard.press('Escape');
}

async function switchFormat(page, format, accept = true) {
  await page.getByTestId('content-settings').click();
  await choose(page, 'content-type', FORMATS[format]);
  if (accept) await confirm(page);
  else await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.keyboard.press('Escape');
}

const FORMATS = { richtext: 'Rich text', html: 'Raw HTML', markdown: 'Markdown', plain: 'Plain text', visual: 'Visual' };

async function visualDocument(page, document) {
  const iframe = page.getByTestId('visual-editor');
  await expect(iframe).toBeVisible();
  // Seed the builder through its public document API; serialization runs in the real iframe.
  await expect.poll(() => iframe.evaluate((el) => !!el.contentWindow?.EmailBuilder
    && !!el.contentDocument?.getElementById('visual-editor-container')?.hasChildNodes())).toBeTruthy();
  await iframe.evaluate((el, doc) => el.contentWindow.EmailBuilder.resetDocument(doc), document);
}

async function fillBody(page, format, text) {
  if (format === 'visual') {
    await visualDocument(page, {
      root: { type: 'EmailLayout', data: { childrenIds: ['text'] } },
      text: { type: 'Text', data: { props: { text: 'Write your message' }, style: {} } },
    });
    const frame = page.frameLocator('[data-testid=visual-editor]');
    await frame.getByText('Write your message', { exact: true }).click();
    await frame.getByRole('textbox', { name: 'Content', exact: true }).fill(text);
    await expect(frame.locator('td').getByText(text, { exact: true })).toBeVisible();
  } else if (format === 'richtext') {
    await page.getByTestId('richtext-content').fill(text);
  } else if (format === 'plain') {
    await page.locator('textarea[name="content"]').fill(text);
  } else {
    await page.getByTestId('editor-body').locator('.cm-content').fill(format === 'html' ? `<strong>${text}</strong>` : `**${text}**`);
  }
}

async function delivered(subject) {
  let mail;
  await expect.poll(async () => {
    mail = (await getMail()).find((m) => m.Content.Headers.Subject?.[0] === subject);
    return !!mail;
  }, { timeout: 20000 }).toBeTruthy();
  return mail;
}

// The loaded iframe takes keyboard focus, so Escape would not reach the dialog.
async function closePreview(page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function preview(page, text, testId = 'btn-preview') {
  await page.getByTestId(testId).click();
  await expect(previewFrame(page).locator('body')).toContainText(text);
  await closePreview(page);
}

test.beforeEach(async ({ browser }) => {
  await resetDB(browser);
});

test('shows the seeded campaign and previews it from the listing', async ({ page }) => {
  await page.goto(CAMPAIGNS);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Draft');
  await expect(rows(page).getByTestId('campaign-lists')).toContainText('Default list');
  await openMenu(rows(page));
  await page.getByTestId('btn-preview').click();
  await expect(previewFrame(page).locator('body')).toContainText('Hi');
  await closePreview(page);
});

test("shows only a list's campaigns on its overview page", async ({ page }) => {
  await create(page, { name: 'On the opt-in list', lists: [2] });
  await create(page, { name: 'On the default list', lists: [1] });
  await page.goto('/admin/lists/2');
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, 'On the opt-in list')).toBeVisible();
  // Read-only here: no selection checkboxes.
  await expect(page.locator('thead').getByRole('checkbox')).toHaveCount(0);
});

for (const format of ['richtext', 'html', 'markdown', 'plain', 'visual']) {
  for (const lists of [['Default list'], ['Default list', 'Opt-in list']]) {
    test(`creates, edits and previews ${format} with ${lists.length} list(s)`, async ({ page }) => {
      await page.goto(CAMPAIGNS);
      await page.getByTestId('btn-new').click();
      await expect(tab(page, 'Content')).toBeDisabled();
      await page.getByLabel('Name', { exact: true }).fill(`New ${format}`);
      await page.getByLabel('Subject', { exact: true }).fill(`Subject ${format}`);
      await page.locator('input[name="from_email"]').fill('Sender <sender@example.com>');
      await choose(page, 'content-type', FORMATS[format]);
      for (const name of lists) await pickList(page, name);
      for (const tag of ['news', 'monthly']) {
        await page.locator('#c-tags').fill(tag);
        await page.locator('#c-tags').press('Enter');
      }
      await page.getByRole('switch', { name: 'Custom headers', exact: true }).click();
      await page.locator('textarea[name="headers"]').fill('[{"X-Custom":"value"}]');
      await page.getByTestId('btn-continue').click();
      await expect(page).toHaveURL(/\/campaigns\/\d+#tab=content$/);
      const id = Number(new URL(page.url()).pathname.split('/').pop());
      await expect(tab(page, 'Content')).toHaveAttribute('aria-selected', 'true');
      await fillBody(page, format, expression);
      await save(page, id);
      await page.reload();
      await expect(page.getByTestId('editor-body')).toBeVisible();
      const saved = await campaign(page, id);
      expect(saved).toMatchObject({ name: `New ${format}`, subject: `Subject ${format}`, status: 'draft',
        content_type: format, from_email: 'Sender <sender@example.com>',
        headers: [{ 'X-Custom': 'value' }], send_at: null, altbody: null });
      expect(saved.tags.sort()).toEqual(['monthly', 'news']);
      expect(saved.lists.map((l) => l.id).sort()).toEqual(lists.length === 1 ? [1] : [1, 2]);
      expect(saved.body).toContain(expression);
      if (format === 'visual') expect(JSON.parse(saved.body_source).text.data.props.text).toBe(expression);
      await preview(page, rendered);
      await page.goto(CAMPAIGNS);
      await expect(row(page, `New ${format}`)).toContainText(`Subject ${format}`);
      await expect(row(page, `New ${format}`).getByTestId('campaign-lists').locator('a')).toHaveCount(lists.length);
    });
  }
}

test('edits metadata, schedules in local time, unschedules and clears the schedule', async ({ page }) => {
  const c = await create(page, { lists: [2], tags: ['old'] });
  await page.goto(`${CAMPAIGNS}/${c.id}`);
  await page.getByLabel('Name', { exact: true }).fill('Scheduled newsletter');
  await page.getByLabel('Subject', { exact: true }).fill('Updated subject');
  await page.locator('input[name="from_email"]').fill('New <new@example.com>');
  await page.getByRole('button', { name: 'Remove Opt-in list' }).click();
  await pickList(page, 'Default list');
  const tags = page.locator('#c-tags');
  await tags.press('Backspace');
  await tags.fill('new-tag');
  await tags.press('Enter');
  await page.getByRole('switch', { name: 'Custom headers', exact: true }).click();
  await page.locator('textarea[name="headers"]').fill('[{"X-Custom":"Custom-Value"}]');
  await page.getByRole('switch', { name: 'Send later', exact: true }).click();
  const when = `${new Date().getFullYear() + 1}-06-15T09:30`;
  await page.locator('input[name="send_at"]').fill(when);
  const iso = await page.evaluate((value) => new Date(value).toISOString(), when);
  await expect(page.getByTestId('btn-start')).toHaveCount(0);
  await tab(page, 'Content').click();
  await switchFormat(page, 'plain');
  await fillBody(page, 'plain', 'Scheduled body');
  await tab(page, 'Campaign').click();
  await page.getByTestId('btn-schedule').click();
  await confirm(page);
  await expect(page).toHaveURL(/\/admin\/campaigns$/);
  await expect(row(page, 'Scheduled newsletter')).toContainText('Scheduled');
  const saved = await campaign(page, c.id);
  expect(saved).toMatchObject({ status: 'scheduled', name: 'Scheduled newsletter', subject: 'Updated subject',
    from_email: 'New <new@example.com>', content_type: 'plain', body: 'Scheduled body', altbody: null,
    tags: ['new-tag'], headers: [{ 'X-Custom': 'Custom-Value' }] });
  expect(new Date(saved.send_at).toISOString()).toBe(iso);
  expect(saved.lists.map((l) => l.id)).toEqual([1]);
  await page.goto(`${CAMPAIGNS}/${c.id}`);
  await expect(page.locator('input[name="send_at"]')).toHaveValue(when);
  await page.getByTestId('btn-unschedule').click();
  await confirm(page);
  await expect(page.getByTestId('campaign-status')).toContainText('Draft');
  await page.getByRole('switch', { name: 'Send later', exact: true }).click();
  await save(page, c.id);
  expect((await campaign(page, c.id)).send_at).toBeNull();
  await expect(page.getByTestId('btn-start')).toBeVisible();
});

test('converts formats and cancels conversion without losing content', async ({ page }) => {
  const c = await create(page, { content_type: 'richtext' });
  await page.goto(`${CAMPAIGNS}/${c.id}#tab=content`);
  await expect(page.getByTestId('richtext-editor')).toBeVisible();
  await switchFormat(page, 'plain', false);
  await expect(page.getByTestId('richtext-editor')).toBeVisible();
  for (const format of ['html', 'markdown', 'plain']) {
    await switchFormat(page, format);
    await save(page, c.id);
    expect(await campaign(page, c.id)).toMatchObject({ content_type: format });
    await preview(page, rendered);
    await page.reload();
  }
});

test('previews and test-sends unsaved content without modifying the draft', async ({ page }) => {
  const c = await create(page, { content_type: 'plain', body: 'Saved body', subject: 'Preview test' });
  await page.goto(`${CAMPAIGNS}/${c.id}#tab=content`);
  await fillBody(page, 'plain', 'Unsaved hello {{ .Subscriber.Name }}');
  await preview(page, 'Unsaved hello Demo Subscriber');
  await page.getByTestId('btn-test').click();
  await page.locator('#campaign-test input[type="email"]').fill('john@example.com');
  await page.locator('#campaign-test input[type="email"]').press('Enter');
  await button(page.locator('#campaign-test'), 'Send').click();
  expect(JSON.stringify(await delivered('Preview test'))).toContain('Unsaved hello');
  expect(await campaign(page, c.id)).toMatchObject({ status: 'draft', body: 'Saved body' });
});

test('generates, persists and removes alternate text; plain format clears it', async ({ page }) => {
  const c = await create(page, { body: '<p>Alternate message</p>' });
  await page.goto(`${CAMPAIGNS}/${c.id}#tab=content`);
  await expect(page.getByTestId('editor-body')).toBeVisible();
  const toggle = page.getByTestId('altbody-toggle');
  await toggle.click();
  const alt = page.getByRole('textbox', { name: 'Add alternate plain text message', exact: true });
  await expect(alt).toHaveValue('Alternate message');
  await alt.fill('Custom alternate');
  await save(page, c.id);
  await page.reload();
  await expect(alt).toHaveValue('Custom alternate');
  await toggle.click();
  await confirm(page);
  await save(page, c.id);
  expect((await campaign(page, c.id)).altbody).toBeNull();
  await toggle.click();
  await switchFormat(page, 'plain');
  await save(page, c.id);
  expect((await campaign(page, c.id)).altbody).toBeNull();
});

test('persists attributes and archive settings with keyboard save', async ({ page }) => {
  const c = await create(page);
  await page.goto(`${CAMPAIGNS}/${c.id}`);
  await tab(page, 'Attributes').click();
  await page.getByRole('textbox', { name: 'Attributes', exact: true }).fill('{"edition":42}');
  await tab(page, 'Archive').click();
  await page.getByTestId('archive-toggle').click();
  await page.locator('input[name="archive_slug"]').fill('newsletter-edition-42');
  await page.locator('textarea[name="archive_meta"]').fill('{"name":"Archive reader","attribs":{"city":"Mumbai"}}');
  await save(page, c.id, () => page.locator('textarea[name="archive_meta"]').press('ControlOrMeta+s'));
  await page.reload();
  await expect(page.locator('input[name="archive_slug"]')).toHaveValue('newsletter-edition-42');
  await preview(page, 'Hello Archive reader from Mumbai', 'archive-preview');
  expect(await campaign(page, c.id)).toMatchObject({ attribs: { edition: 42 }, archive: true,
    archive_slug: 'newsletter-edition-42', archive_meta: { name: 'Archive reader', attribs: { city: 'Mumbai' } } });
});

test('rejects malformed JSON without overwriting saved metadata', async ({ page }) => {
  const c = await create(page, { headers: [{ 'X-Custom': 'saved' }], attribs: { edition: 1 } });
  await page.goto(`${CAMPAIGNS}/${c.id}`);
  for (const [name, field, valid] of [
    ['Campaign', 'textarea[name="headers"]', '[{"X-Custom":"saved"}]'],
    ['Attributes', 'textarea[aria-label="Attributes"]', '{"edition":1}'],
  ]) {
    await tab(page, name).click();
    await page.locator(field).fill('{broken');
    await page.getByTestId('btn-save').click();
    await expect(page.locator('[data-sonner-toast]').last()).toContainText(/JSON|SyntaxError/);
    expect(await campaign(page, c.id)).toMatchObject({ headers: [{ 'X-Custom': 'saved' }], attribs: { edition: 1 } });
    await page.locator(field).fill(valid);
    await save(page, c.id);
  }
});

test('clones full content into a draft and cancels cloning and deletion', async ({ page }) => {
  const c = await create(page, { tags: ['clone'], headers: [{ 'X-Custom': 'copy' }],
    attribs: { edition: 2 }, altbody: 'Alternative', lists: [1, 2] });
  await page.goto(CAMPAIGNS);
  await menu(page, c.name, 'btn-clone');
  await page.keyboard.press('Escape');
  await expect(rows(page)).toHaveCount(2);
  await menu(page, c.name, 'btn-clone');
  await page.getByRole('dialog').getByRole('textbox').fill('Cloned newsletter');
  await button(page.getByRole('dialog'), 'Clone').click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  const clone = await campaign(page, id);
  for (const key of ['subject', 'body', 'content_type', 'altbody', 'headers', 'attribs', 'tags']) expect(clone[key]).toEqual(c[key]);
  expect(clone).toMatchObject({ name: 'Cloned newsletter', status: 'draft' });
  expect(clone.uuid).not.toBe(c.uuid);
  expect(clone.lists.map((l) => l.id)).toEqual([1, 2]);
  await page.goto(CAMPAIGNS);
  await menu(page, clone.name, 'btn-delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(row(page, clone.name)).toBeVisible();
  await menu(page, clone.name, 'btn-delete');
  await confirm(page);
  await expect(row(page, clone.name)).toHaveCount(0);
  await expect(row(page, c.name)).toBeVisible();
});

test('searches, filters and sorts campaigns', async ({ page }) => {
  await data(await page.request.delete('/api/campaigns?all=true'));
  for (const name of ['Bravo', 'Alpha', 'Charlie']) await create(page, { name, tags: [name === 'Charlie' ? 'other' : 'news'] });
  const scheduled = await create(page, { name: 'Scheduled', send_at: new Date(Date.now() + 86400000).toISOString() });
  await data(await page.request.put(`/api/campaigns/${scheduled.id}/status`, { data: { status: 'scheduled' } }));
  await page.goto(CAMPAIGNS);
  await page.getByTestId('query').fill('Alpha');
  await page.getByTestId('query').press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, 'Alpha')).toBeVisible();
  await page.goto(CAMPAIGNS);
  await row(page, 'Alpha').getByRole('button', { name: '#news', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page).toHaveURL(/[?&]tag=news/);
  await page.getByTestId('query').fill('Alpha');
  await page.getByTestId('query').press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(page).toHaveURL(/[?&]tag=news/);
  await page.getByTestId('btn-remove-filter').click();
  await expect(page).not.toHaveURL(/[?&]tag=/);
  await expect(row(page, 'Alpha')).toBeVisible();
  await page.goto(CAMPAIGNS);
  await row(page, 'Alpha').getByTitle('Filter Draft', { exact: true }).click();
  await expect(page).toHaveURL(/[?&]status=draft/);
  await expect(rows(page)).toHaveCount(3);
  for (const [header, orders] of [
    ['Name', [['Alpha', 'Bravo', 'Charlie'], ['Charlie', 'Bravo', 'Alpha']]],
    ['Timestamps', [['Bravo', 'Alpha', 'Charlie'], ['Charlie', 'Alpha', 'Bravo']]],
  ]) {
    for (const names of orders) {
      await page.locator('thead').getByRole('button', { name: header }).click();
      await expect(rows(page).getByTestId('campaign-name')).toHaveText(names);
      await expect(page).toHaveURL(/[?&]status=draft/);
    }
  }
});

for (const { label, all, filter, unrelated } of [
  { label: 'selected IDs', all: false, filter: 'query=Bulk' },
  { label: 'all matching pages', all: true, filter: 'query=Bulk' },
  { label: 'all tagged campaigns', all: true, filter: 'tag=target', unrelated: [{ tags: ['other'] }] },
  { label: 'all campaigns with a status', all: true, filter: 'status=draft', unrelated: [{ status: 'scheduled' }] },
  { label: 'all campaigns of a type', all: true, filter: 'type=regular', unrelated: [{ type: 'optin', lists: [2] }] },
  {
    label: 'all campaigns matching combined filters', all: true,
    filter: 'query=Bulk&tag=target&tag=news&status=draft&type=regular',
    unrelated: [
      { name: 'Other' }, { tags: ['target'] }, { status: 'scheduled' }, { type: 'optin', lists: [2] },
    ],
  },
]) {
  test(`bulk deletes ${label} and preserves other campaigns`, async ({ page }) => {
    const preserved = [];
    if (unrelated) {
      await data(await page.request.delete('/api/campaigns?all=true'));
      for (const { status, ...overrides } of unrelated) {
        const c = await create(page, {
          name: 'Bulk unrelated', tags: ['target', 'news'],
          ...(status ? { send_at: new Date(Date.now() + 86400000).toISOString() } : {}),
          ...overrides,
        });
        if (status) await data(await page.request.put(`/api/campaigns/${c.id}/status`, { data: { status } }));
        preserved.push(c.id);
      }
    }
    for (let i = 0; i < (all ? 22 : 3); i += 1) {
      await create(page, { name: `Bulk ${i}`, tags: ['target', 'news'] });
    }
    await page.goto(`${CAMPAIGNS}?${filter}`);
    await expect(rows(page).first()).toBeVisible();
    await page.locator('thead').getByRole('checkbox').click();
    if (all) await page.getByTestId('select-all-matching').click();
    await page.getByTestId('btn-delete-campaigns').click();
    await confirm(page);
    await expect(rows(page)).toHaveCount(0);
    await page.goto(CAMPAIGNS);
    if (unrelated) {
      await expect(rows(page)).toHaveCount(preserved.length);
      expect(await rows(page).evaluateAll((els) => els.map((el) => Number(el.dataset.campaignId)).sort((a, b) => a - b)))
        .toEqual(preserved.sort((a, b) => a - b));
    } else {
      await expect(rows(page)).toHaveCount(1);
    }
  });
}

test('bulk deletion handles no matches, explicit IDs and unfiltered requests', async ({ page }) => {
  const c = await create(page, { tags: ['target'] });
  const ids = async () => (await data(await page.request.get('/api/campaigns'))).results.map((r) => r.id).sort((a, b) => a - b);
  const before = await ids();
  await data(await page.request.delete('/api/campaigns?all=true&tag=missing'));
  expect(await ids()).toEqual(before);
  await data(await page.request.delete(`/api/campaigns?id=${c.id}&tag=missing&status=paused&type=optin`));
  expect(await ids()).toEqual(before.filter((id) => id !== c.id));
  await data(await page.request.delete('/api/campaigns?all=true'));
  expect(await ids()).toEqual([]);
});

test('bulk deletion respects list permissions as well as filters', async ({ page, browser }) => {
  const permitted = await create(page, { tags: ['target'], lists: [1] });
  const forbidden = await create(page, { tags: ['target'], lists: [2] });
  const unrelated = await create(page, { tags: ['other'], lists: [1] });
  const role = await data(await page.request.post('/api/roles/users', { data: {
    name: 'Campaign manager', permissions: ['campaigns:get', 'campaigns:manage'],
  } }));
  const listRole = await data(await page.request.post('/api/roles/lists', { data: {
    name: 'Default list manager', lists: [{ id: 1, permissions: ['list:get', 'list:manage'] }],
  } }));
  const user = await data(await page.request.post('/api/users', { data: {
    username: 'bulk-manager', type: 'api', status: 'enabled', user_role_id: role.id, list_role_id: listRole.id,
  } }));
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { Authorization: `Basic ${Buffer.from(`${user.username}:${user.password}`).toString('base64')}` },
  });
  try {
    await data(await context.request.delete('/api/campaigns?all=true&tag=target'));
  } finally {
    await context.close();
  }
  const remaining = (await data(await page.request.get('/api/campaigns'))).results.map((c) => c.id);
  expect(remaining).not.toContain(permitted.id);
  expect(remaining).toContain(forbidden.id);
  expect(remaining).toContain(unrelated.id);
});

test('uploads an attachment, persists it and delivers it when starting from the editor', async ({ page }) => {
  const c = await create(page, { subject: 'Attachment delivery' });
  await page.goto(`${CAMPAIGNS}/${c.id}`);
  await tab(page, 'Attachments').click();
  await page.getByTestId('attach').click();
  const picker = page.getByTestId('media-picker');
  await picker.getByTestId('file-input').setInputFiles({ name: 'campaign-example.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"attachment"}') });
  await picker.getByTitle('campaign-example.json', { exact: true }).first().click();
  await expect(picker).not.toBeVisible();
  await save(page, c.id);
  await page.reload();
  await expect(page.locator('.attachments .filename')).toHaveText('campaign-example.json');
  expect((await campaign(page, c.id)).media).toHaveLength(1);
  await tab(page, 'Campaign').click();
  await page.getByTestId('btn-start').click();
  await confirm(page);
  await expect(page).toHaveURL(/\/admin\/campaigns$/);
  expect(JSON.stringify(await delivered(c.subject))).toContain('campaign-example.json');
  await expect.poll(async () => (await campaign(page, c.id)).status, { timeout: 20000 }).toBe('finished');
  await page.reload();
  await expect(row(page, c.name)).toContainText('Finished');
  await page.goto(`${CAMPAIGNS}/${c.id}`);
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
  await expect(page.getByTestId('btn-start')).toHaveCount(0);
  await tab(page, 'Archive').click();
  await page.getByTestId('archive-toggle').click();
  await page.locator('input[name="archive_slug"]').fill('delivered-newsletter');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/api/campaigns/${c.id}/archive`) && r.request().method() === 'PUT'),
    page.getByTestId('save-archive').click(),
  ]);
  await data(response);
  expect(await campaign(page, c.id)).toMatchObject({ status: 'finished', archive: true, archive_slug: 'delivered-newsletter' });
});

test('starts, pauses, resumes and cancels from the listing', async ({ page }) => {
  // Keep sending long enough to change status at the default rate of 10 messages/s.
  const list = await data(await page.request.post('/api/lists', { data: { name: 'Slow audience', type: 'private', optin: 'single' } }));
  for (let i = 0; i < 150; i += 1) {
    await data(await page.request.post('/api/subscribers', { data: {
      email: `lifecycle-${i}@example.com`, name: `Reader ${i}`, status: 'enabled', lists: [list.id],
    } }));
  }
  const c = await create(page, { lists: [list.id] });
  await page.goto(CAMPAIGNS);
  for (const [action, status] of [['btn-start', 'running'], ['btn-pause', 'paused'], ['btn-resume', 'running'], ['btn-cancel', 'cancelled']]) {
    await menu(page, c.name, action);
    await confirm(page);
    await expect(row(page, c.name)).toHaveAttribute('data-status', status);
    expect((await campaign(page, c.id)).status).toBe(status);
  }
  await openMenu(row(page, c.name));
  await expect(page.getByTestId('btn-start')).toHaveCount(0);
});

for (const format of ['richtext', 'visual']) {
  for (const embed of [true, false]) {
    test(`${format} image ${embed ? 'embeds as MIME/CID' : 'stays a URL'} after reload`, async ({ page }) => {
      const c = await create(page, { content_type: format, body: '', subject: `${format} image ${embed}` });
      const media = await data(await page.request.post('/api/media', { multipart: { file: {
        name: 'campaign-pixel.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64'),
      } } }));
      await page.goto(`${CAMPAIGNS}/${c.id}#tab=content`);
      await expect(page.getByTestId('editor-body')).toBeVisible();
      if (format === 'richtext') {
        await button(page, 'Image').click();
        const dialog = page.getByRole('dialog').filter({ has: page.locator('input[name="src"]') });
        await dialog.getByTestId('rte-browse').click();
        await page.getByTestId('media-picker').getByTitle(media.filename, { exact: true }).first().click();
        await expect(dialog.locator('input[name="src"]')).toHaveValue(media.url);
        await dialog.getByRole('checkbox', { name: 'Embed', exact: true }).setChecked(embed);
        await button(dialog, 'Save').click();
        await expect(page.getByTestId('richtext-content').locator('img')).toHaveAttribute('src', media.url);
      } else {
        await visualDocument(page, {
          root: { type: 'EmailLayout', data: { childrenIds: ['image'] } },
          image: { type: 'Image', data: { props: { url: media.url, embed: false }, style: {} } },
        });
        const frame = page.frameLocator('[data-testid=visual-editor]');
        await frame.locator('#visual-editor-container img').click();
        await frame.getByRole('checkbox').setChecked(embed);
      }
      await save(page, c.id);
      await page.reload();
      await expect(page.getByTestId('editor-body')).toBeVisible();
      if (format === 'richtext') {
        await page.getByTestId('richtext-content').locator('img').click();
        await button(page, 'Image').click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('checkbox', { name: 'Embed', exact: true })).toBeChecked({ checked: embed });
        await button(dialog, 'Cancel').click();
      } else {
        const frame = page.frameLocator('[data-testid=visual-editor]');
        await frame.locator('#visual-editor-container img').click();
        await expect(frame.getByRole('checkbox')).toBeChecked({ checked: embed });
      }
      await tab(page, 'Campaign').click();
      await page.getByTestId('btn-start').click();
      await confirm(page);
      const raw = JSON.stringify(await delivered(c.subject));
      expect(raw.includes('image/png')).toBe(embed);
      expect(raw.includes('cid:')).toBe(embed);
      expect(raw.includes('Content-Id')).toBe(embed);
    });
  }
}

for (const tracked of [true, false]) {
  test(`richtext link tracking follows the URL (${tracked ? 'on' : 'off'}) and persists toggles`, async ({ page }) => {
    const url = 'https://example.com/docs?edition=42#intro';
    const href = (track) => `${url}${track ? '@TrackLink' : ''}`;
    const c = await create(page, { content_type: 'richtext', body:
      `<p><a href="${href(tracked)}">Documentation</a> <a href="${href(!tracked)}">Other link</a></p>` });
    await page.goto(`${CAMPAIGNS}/${c.id}#tab=content`);
    await expect(page.getByTestId('richtext-editor')).toBeVisible();

    // Existing links must override the remembered preference for newly inserted links.
    await page.evaluate((value) => localStorage.setItem('trackLink', String(value)), !tracked);
    const editor = page.getByTestId('richtext-content');
    const link = editor.getByRole('link', { name: 'Documentation', exact: true });
    const dialog = page.getByRole('dialog');
    const checkbox = dialog.getByRole('checkbox', { name: /Track link/ });
    await link.click();
    await button(page, 'Link').click();
    await expect(dialog.locator('input[name="url"]')).toHaveValue(url);
    await expect(checkbox).toBeChecked({ checked: tracked });
    await button(dialog, 'Cancel').click();

    // Reusing the URL dialog for another link must recompute the checkbox state.
    await editor.getByRole('link', { name: 'Other link', exact: true }).click();
    await button(page, 'Link').click();
    await expect(checkbox).toBeChecked({ checked: !tracked });
    await button(dialog, 'Cancel').click();
    await link.click();
    await button(page, 'Link').click();
    await expect(checkbox).toBeChecked({ checked: tracked });
    await checkbox.setChecked(!tracked);
    await button(dialog, 'Save').click();
    await expect(link).toHaveAttribute('href', href(!tracked));
    await save(page, c.id);
    expect((await campaign(page, c.id)).body).toContain(`href="${href(!tracked)}"`);
    await page.reload();
    await expect(page.getByTestId('richtext-editor')).toBeVisible();
    await link.click();
    await button(page, 'Link').click();
    await expect(dialog.locator('input[name="url"]')).toHaveValue(url);
    await expect(checkbox).toBeChecked({ checked: !tracked });
    await button(dialog, 'Cancel').click();
  });
}
