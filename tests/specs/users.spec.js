import { test, expect } from '@playwright/test';
import { openMenu, confirm, resetDB, resetDBBlank } from '../helpers.js';

const USERS = '/admin/users';
const USER_ROLES = '/admin/users/roles';
const LIST_ROLES = '/admin/users/roles/lists';

function roleRow(page, name) {
  const rows = page.getByTestId('role-row');
  return name ? rows.filter({ hasText: name }) : rows;
}

function userRow(page, name) {
  const rows = page.getByTestId('user-row');
  return name ? rows.filter({ hasText: name }) : rows;
}

// Pick an option of a (Radix) select by its test id and visible name.
async function choose(page, testId, name) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name, exact: true }).click();
}

// Open a role's edit view by name (via the listing), reloading it from the server.
async function gotoRoleEdit(page, base, name) {
  await page.goto(base);
  const id = await roleRow(page, name).getAttribute('data-id');
  await page.goto(`${base}/${id}`);
}

// Open a user's edit view by name, reloading it from the server.
async function gotoUserEdit(page, name) {
  await page.goto(USERS);
  const id = await userRow(page, name).getAttribute('data-id');
  await page.goto(`${USERS}/${id}`);
}

async function login(page, username, password) {
  await page.goto('/admin/login?next=/admin/lists');
  await page.locator('input[name=username]').fill(username);
  await page.locator('input[name=password]').fill(password);
  await Promise.all([
    page.waitForURL('**/admin/lists'),
    page.locator('form[action="/admin/login"] button[type=submit]').click(),
  ]);
}

test.describe.configure({ mode: 'serial' });

test.describe('First-time user setup', () => {
  // Start unauthenticated: the blank DB has no users yet.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    await resetDBBlank();
  });

  test('creates the initial superadmin user', async ({ page }) => {
    await page.goto('/admin/login');

    await page.locator('input[name=email]').fill('super@domain.com');
    await page.locator('input[name=username]').fill('super');
    await page.locator('input[name=password]').fill('super123');
    await page.locator('input[name=password2]').fill('super123');
    await Promise.all([
      page.waitForURL((url) => !url.pathname.includes('/login')),
      page.locator('button[type=submit]').click(),
    ]);

    // The new user is the "Super Admin" (role id 1).
    await page.goto(USERS);
    const row = userRow(page, 'super');
    await openMenu(row);
    await page.getByTestId('btn-edit').click();
    await expect(page).toHaveURL(/\/admin\/users\/\d+$/);
    await expect(page.getByTestId('user-role')).toContainText('Super Admin');
  });
});

test.describe('Users, roles & login', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDB(browser);
  });

  test('adds user roles', async ({ page }) => {
    // "first": accept the default permissions.
    await page.goto(USER_ROLES);
    await page.getByTestId('btn-new').click();
    await page.locator('input[name=name]').fill('first');
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith('/users/roles')),
      page.getByTestId('btn-save').click(),
    ]);

    // "second": every permission checked.
    await page.getByTestId('btn-new').click();
    await page.locator('input[name=name]').fill('second');
    const boxes = page.locator('form [role=checkbox]');
    for (let i = 0, n = await boxes.count(); i < n; i += 1) {
      if ((await boxes.nth(i).getAttribute('aria-checked')) !== 'true') await boxes.nth(i).click();
    }
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith('/users/roles')),
      page.getByTestId('btn-save').click(),
    ]);

    await expect(roleRow(page)).toHaveCount(3);

    // Reopen "second": every permission checkbox came back checked.
    await gotoRoleEdit(page, USER_ROLES, 'second');
    await expect(page.locator('form [role=checkbox][aria-checked=true]')).not.toHaveCount(0);
    await expect(page.locator('form [role=checkbox][aria-checked=false]')).toHaveCount(0);
  });

  test('edits a user role', async ({ page }) => {
    await page.goto(USER_ROLES);
    const row = roleRow(page, 'first');
    await openMenu(row);
    await page.getByTestId('btn-edit').click();

    await page.getByRole('checkbox', { name: 'users:get', exact: true }).check();
    await Promise.all([
      page.waitForResponse((r) => /\/api\/roles\/users\/\d+/.test(r.url()) && r.request().method() === 'PUT'),
      page.getByTestId('btn-save').click(),
    ]);

    // Reopen the role: "users:get" (not a default) is checked, proving the edit stuck.
    await gotoRoleEdit(page, USER_ROLES, 'first');
    await expect(page.getByRole('checkbox', { name: 'users:get', exact: true })).toBeChecked();
  });

  test('clones and deletes a user role', async ({ page }) => {
    await page.goto(USER_ROLES);

    const source = roleRow(page).last();
    await openMenu(source);
    await page.getByTestId('btn-clone').click();
    await page.getByTestId('clone-name').fill('second copy');
    await page.getByTestId('btn-clone-ok').click();
    await expect(roleRow(page)).toHaveCount(4);
    await expect(roleRow(page, 'second copy')).toBeVisible();

    const last = roleRow(page, 'second copy');
    await openMenu(last);
    await page.getByTestId('btn-delete').click();
    await confirm(page);
    await expect(roleRow(page)).toHaveCount(3);
    await expect(roleRow(page, 'second copy')).toHaveCount(0);
  });

  test('the super admin role is read-only and cannot be deleted', async ({ page }) => {
    await page.goto(USER_ROLES);
    const row = roleRow(page, 'Super Admin');
    await openMenu(row);
    await expect(page.getByTestId('btn-delete')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await gotoRoleEdit(page, USER_ROLES, 'Super Admin');
    await expect(page.locator('input[name=name]')).toBeDisabled();
    await expect(page.getByTestId('btn-save')).toHaveCount(0);
  });

  test('adds list roles', async ({ page }) => {
    // "first": a single list.
    await page.goto(LIST_ROLES);
    await page.getByTestId('btn-new').click();
    await page.locator('input[name=name]').fill('first');
    await page.getByTestId('btn-add-list').click();
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith('/roles/lists')),
      page.getByTestId('btn-save').click(),
    ]);

    // "second": both lists.
    await page.getByTestId('btn-new').click();
    await page.locator('input[name=name]').fill('second');
    await page.getByTestId('btn-add-list').click();
    await page.getByTestId('btn-add-list').click();
    await Promise.all([
      page.waitForURL((url) => url.pathname.endsWith('/roles/lists')),
      page.getByTestId('btn-save').click(),
    ]);

    await expect(roleRow(page)).toHaveCount(2);

    // Reopen each: "first" lists one row, "second" lists both.
    await gotoRoleEdit(page, LIST_ROLES, 'first');
    await expect(page.getByTestId('role-list-row')).toHaveCount(1);
    await gotoRoleEdit(page, LIST_ROLES, 'second');
    await expect(page.getByTestId('role-list-row')).toHaveCount(2);
  });

  test('edits a list role', async ({ page }) => {
    await page.goto(LIST_ROLES);
    const row = roleRow(page, 'second');
    await openMenu(row);
    await page.getByTestId('btn-edit').click();

    // Drop the "manage" permission on the second list.
    await page.getByTestId('role-list-row').nth(1).locator('[data-perm="list:manage"]').click();
    await Promise.all([
      page.waitForResponse((r) => /\/api\/roles\/lists\/\d+/.test(r.url()) && r.request().method() === 'PUT'),
      page.getByTestId('btn-save').click(),
    ]);

    // Reopen the role: both lists keep "view", exactly one lost "manage".
    await gotoRoleEdit(page, LIST_ROLES, 'second');
    await expect(page.locator('[data-perm="list:get"][aria-checked=true]')).toHaveCount(2);
    await expect(page.locator('[data-perm="list:manage"][aria-checked=true]')).toHaveCount(1);
  });

  test('clones and deletes a list role', async ({ page }) => {
    await page.goto(LIST_ROLES);

    const source = roleRow(page).last();
    await openMenu(source);
    await page.getByTestId('btn-clone').click();
    await page.getByTestId('clone-name').fill('second copy');
    await page.getByTestId('btn-clone-ok').click();
    await expect(roleRow(page)).toHaveCount(3);
    await expect(roleRow(page, 'second copy')).toBeVisible();

    const last = roleRow(page, 'second copy');
    await openMenu(last);
    await page.getByTestId('btn-delete').click();
    await confirm(page);
    await expect(roleRow(page)).toHaveCount(2);
    await expect(roleRow(page, 'second copy')).toHaveCount(0);
  });

  test('adds users', async ({ page }) => {
    const cases = [
      { name: 'first', userRole: 'first', listRole: 'first' },
      { name: 'second', userRole: 'second', listRole: 'second' },
      { name: 'third', userRole: 'first', listRole: 'first' },
    ];

    for (const c of cases) {
      await page.goto(USERS);
      await page.getByTestId('btn-new').click();
      await page.locator('input[name=username]').fill(c.name);
      await page.locator('input[name=name]').fill(c.name);
      await page.locator('input[name=email]').fill(`${c.name}@domain.com`);
      await page.locator('input[name=password]').fill(`${c.name}000000`);
      await page.locator('input[name=password2]').fill(`${c.name}000000`);
      await choose(page, 'user-role', c.userRole);
      await choose(page, 'list-role', c.listRole);
      await Promise.all([
        page.waitForURL((url) => url.pathname.endsWith('/admin/users')),
        page.getByTestId('btn-save').click(),
      ]);
    }

    // admin + 3 created.
    await expect(userRow(page)).toHaveCount(4);

    // Each row shows its user and list role.
    for (const c of cases) {
      const row = userRow(page).filter({ has: page.getByRole('link', { name: c.name, exact: true }) });
      // The user role and list role are the row's first two buttons (then "More").
      await expect(row.getByRole('button').nth(0)).toHaveText(c.userRole);
      await expect(row.getByRole('button').nth(1)).toHaveText(c.listRole);
    }
  });

  test('validates the form before saving', async ({ page }) => {
    await page.goto(`${USERS}/new`);
    await page.locator('input[name=username]').fill('ab');
    await page.locator('input[name=email]').fill('not-an-email');
    await page.locator('input[name=password]').fill('short');
    await page.locator('input[name=password2]').fill('different');
    await page.getByTestId('btn-save').click();
    await expect(page).toHaveURL(/\/admin\/users\/new$/);
    await expect(page.locator('[data-slot=form-message]')).not.toHaveCount(0);
  });

  test('edits a user', async ({ page }) => {
    await gotoUserEdit(page, 'third');
    await page.getByTestId('password-login').click();
    await choose(page, 'user-role', 'second');
    await choose(page, 'list-role', 'second');
    await Promise.all([
      page.waitForResponse((r) => /\/api\/users\/\d+/.test(r.url()) && r.request().method() === 'PUT'),
      page.getByTestId('btn-save').click(),
    ]);

    // Reopen the edit view: the new roles and disabled password login are reflected.
    await gotoUserEdit(page, 'third');
    await expect(page.getByTestId('password-login')).not.toBeChecked();
    await expect(page.getByTestId('user-role')).toContainText('second');
    await expect(page.getByTestId('list-role')).toContainText('second');
  });

  test('filters the list by role through the URL', async ({ page }) => {
    await page.goto(USERS);
    const row = userRow(page, 'second');
    await row.getByRole('button', { name: 'second', exact: true }).first().click();
    await expect(page).toHaveURL(/user_role_id=\d+/);
    // "second" and (after the edit above) "third" hold the "second" role.
    await expect(userRow(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(userRow(page)).toHaveCount(4);
  });

  test('deletes a user', async ({ page }) => {
    await page.goto(USERS);
    const row = userRow(page, 'third');
    await openMenu(row);
    await page.getByTestId('btn-delete').click();
    await confirm(page);

    await expect(userRow(page)).toHaveCount(3);
    await expect(userRow(page, 'third')).toHaveCount(0);
  });

  test('logs in as a single-list user', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await login(page, 'first', 'first000000');

    // Only the one list granted by the list role, with no create button.
    await expect(page.getByTestId('list-row')).toHaveCount(1);
    await expect(page.getByTestId('list-row')).toContainText('Default list');
    await expect(page.getByTestId('btn-new')).toHaveCount(0);
    await expect(page.getByTestId('list-row').getByTestId('btn-edit')).toHaveCount(1);

    await context.close();
  });

  test('logs in as an all-permissions user', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await login(page, 'second', 'second000000');

    // The superadmin-equivalent role sees every list with full actions.
    await expect(page.getByTestId('list-row')).toHaveCount(2);
    await expect(page.getByTestId('list-row').getByTestId('btn-edit')).toHaveCount(2);
    await expect(page.getByTestId('list-row').getByTestId('btn-delete')).toHaveCount(2);

    await context.close();
  });
});

test.describe('Users: API users and bulk deletion', () => {
  test.beforeEach(async ({ browser }) => {
    await resetDB(browser);
  });

  test('shows the API token once, after creating an API user', async ({ page }) => {
    await page.goto(`${USERS}/new`);
    await choose(page, 'user-type', 'API');
    await page.locator('input[name=username]').fill('ci-bot');
    await expect(page.locator('input[name=password]')).toHaveCount(0);
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/users') && r.request().method() === 'POST'),
      page.getByTestId('btn-save').click(),
    ]);
    const token = await page.getByTestId('api-token').textContent();
    expect(token?.length).toBeGreaterThan(10);
    await page.getByRole('button', { name: 'Close' }).first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(userRow(page, 'ci-bot')).toBeVisible();
  });

  test('deletes only checked users in the filtered view and protects the last admin', async ({ page }) => {
    const data = async (res) => {
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).data;
    };
    const users = [];
    for (let i = 0; i < 3; i += 1) {
      users.push(await data(await page.request.post('/api/users', { data: {
        username: `bulk-${i}`, type: 'api', status: i < 2 ? 'disabled' : 'enabled', user_role_id: 1,
      } })));
    }
    await page.goto(`${USERS}?status=disabled`);
    await expect(userRow(page)).toHaveCount(2);
    await page.getByRole('checkbox', { name: 'Toggle selection' }).click();
    await userRow(page, users[1].username).getByRole('checkbox').click();
    await page.getByTestId('btn-delete-users').click();
    await confirm(page);
    await expect(userRow(page)).toHaveCount(1);
    await page.goto(USERS);
    await expect(userRow(page)).toHaveCount(3);
    await expect(userRow(page, users[0].username)).toHaveCount(0);
    await expect(userRow(page, users[1].username)).toBeVisible();
    await expect(userRow(page, users[2].username)).toBeVisible();
    const res = await page.request.delete('/api/users?id=1');
    expect(res.ok()).toBe(false);
    await page.reload();
    await expect(userRow(page).filter({ has: page.getByRole('link', { name: 'admin', exact: true }) })).toBeVisible();
  });
});
