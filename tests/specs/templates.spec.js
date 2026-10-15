import { test, expect } from '@playwright/test';
import { openMenu, confirm, resetDB } from '../helpers.js';

const TEMPLATES = '/admin/templates';

// Find a template row by name.
function tplRow(page, name) {
  const rows = page.getByTestId('template-row');
  return name ? rows.filter({ hasText: name }) : rows;
}

// Map of template name -> id from the API.
async function templateIDs(page) {
  const { data } = await (await page.request.get('/api/templates')).json();
  return Object.fromEntries(data.map((t) => [t.name, t.id]));
}

test.describe.configure({ mode: 'serial' });

test.describe('Templates', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('shows the seeded default templates', async ({ page }) => {
    await page.goto(TEMPLATES);

    await expect(tplRow(page)).toHaveCount(4);
    for (const name of ['Default campaign template', 'Default archive template',
      'Sample transactional template', 'Sample visual template']) {
      await expect(tplRow(page, name)).toBeVisible();
    }
  });

  test('clones a campaign template', async ({ page }) => {
    await page.goto(TEMPLATES);

    const row = tplRow(page, 'Default campaign template');
    await openMenu(row);
    await page.getByTestId('btn-clone').click();
    await page.getByTestId('clone-name').fill('cloned campaign');
    await page.getByTestId('btn-clone-ok').click();

    await expect(tplRow(page, 'cloned campaign')).toBeVisible();
  });

  test('clones a transactional template', async ({ page }) => {
    await page.goto(TEMPLATES);

    const row = tplRow(page, 'Sample transactional template');
    await openMenu(row);
    await page.getByTestId('btn-clone').click();
    await page.getByTestId('clone-name').fill('cloned tx');
    await page.getByTestId('btn-clone-ok').click();

    await expect(tplRow(page, 'cloned tx')).toBeVisible();
  });

  test('edits a template name and body', async ({ page }) => {
    const ids = await templateIDs(page);
    await page.goto(`${TEMPLATES}/${ids['Default campaign template']}`);

    await page.locator('input[name=name]').fill('edited');

    // The body is a CodeMirror editor: replace its content by typing.
    const body = '<span>test</span><div class="wrap">{{ template "content" . }}</div>';
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(body);

    await Promise.all([
      page.waitForResponse((r) => /\/api\/templates\/\d+$/.test(r.url()) && r.request().method() === 'PUT'),
      page.getByTestId('btn-save').click(),
    ]);

    await page.goto(TEMPLATES);
    await expect(tplRow(page, 'edited')).toBeVisible();
  });

  test('previews templates with the edited and cloned bodies', async ({ page }) => {
    const ids = await templateIDs(page);

    // The edited template has a bare body (the raw "test" markup).
    const edited = await (await page.request.get(`/api/templates/${ids.edited}/preview`)).text();
    expect(edited).toContain('test');
    expect(edited).toContain('Hi there');

    // The clone kept the full campaign template (wrapper + unsubscribe footer).
    const cloned = await (await page.request.get(`/api/templates/${ids['cloned campaign']}/preview`)).text();
    expect(cloned).toContain('Hi there');
    expect(cloned).toContain('Unsubscribe');

    // The cloned transactional template renders its sample content.
    const tx = await (await page.request.get(`/api/templates/${ids['cloned tx']}/preview`)).text();
    expect(tx).toContain('Order number');
  });

  test('sets a new default template', async ({ page }) => {
    await page.goto(TEMPLATES);

    const row = tplRow(page, 'cloned campaign');
    await openMenu(row);
    await page.getByTestId('btn-set-default').click();
    await confirm(page);

    // The new default can't be deleted; the previous default now can.
    await expect(tplRow(page, 'cloned campaign')).toContainText('Default');
    await openMenu(tplRow(page, 'cloned campaign'));
    await expect(page.getByTestId('btn-delete')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await openMenu(tplRow(page, 'edited'));
    await expect(page.getByTestId('btn-delete')).toHaveCount(1);
    await page.keyboard.press('Escape');
  });

  test('the new template form enforces the placeholder and previews unsaved content', async ({ page }) => {
    await page.goto(`${TEMPLATES}/new`);
    await page.locator('input[name=name]').fill('draft');
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('<p>no placeholder</p>');
    // Previewing a campaign template without {{ template "content" . }} is rejected by the server.
    await page.getByTestId('btn-preview').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('deletes templates', async ({ page }) => {
    await page.goto(TEMPLATES);

    for (const name of ['Default archive template', 'Sample transactional template']) {
      const row = tplRow(page, name);
      await openMenu(row);
      await page.getByTestId('btn-delete').click();
      await confirm(page);
      await expect(row).toHaveCount(0);
    }

    await expect(tplRow(page)).toHaveCount(4);
  });
});
