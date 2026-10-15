# Admin Frontend App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the new admin its real shell: API client, i18n, permissions, bootstrap loading, sidebar layout with theme toggle. Prove it by porting one page, the log viewer at `/admin/settings/logs`, end to end.

**Architecture:** No new Go endpoint. The SPA bootstraps from three existing authenticated endpoints in parallel: `GET /api/config` (server config, permissions list, language), `GET /api/profile` (current user with role permissions) and `GET /api/lang/:lang` (translations). A pathless layout route `_app` loads them through TanStack Query and renders the sidebar layout. Ported pages are client-side routes; unported sidebar entries are plain links so the browser loads the old Go page. Go flips `/admin/settings/logs` from the template handler to the SPA shell.

**Tech Stack:** TanStack Start (SPA) + Router, TanStack Query, shadcn/ui (sidebar, sheet, tooltip, sonner…), Tailwind v4, bun test, Go (echo), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-migration-design.md` (rollout step 2). Deviations from the spec, with reasons:

- **No `GET /api/bootstrap`.** Everything it would return already exists in `/api/config`, `/api/profile` and `/api/lang/:lang`. Skipping it avoids Go work and a second source of truth. Site name, favicon and asset versions are not needed: the shell is static, and `/admin/custom.css` and `/admin/custom.js` are served uncached-by-version from config at request time.
- **No shared data table or confirm dialog yet.** The log viewer uses neither. They are built in plan 3 with the first page that needs them (users), so they are shaped by a real use.

## Global Constraints

- Dark mode is class-based (`.dark` on `<html>`), modes light / dark / system, localStorage key `theme`. Every new component and the logs page must be verified in both themes.
- Tooling: bun for install/scripts/tests, oxlint, oxfmt. No eslint, no prettier. `bun run lint`, `bun run fmt:check`, `bun run typecheck`, `bun test`, `bun run build` must be clean before each commit.
- The app can be served under a root-URL sub-path (`window._LM_ROOT`, `""` or `"/lm"`). Every browser-facing URL (API calls, hard links, login redirect) must carry it. The router's own links are handled by the existing rewrite in `src/lib/basepath.ts`.
- Unauthenticated API calls return HTTP 403 with message `invalid session` or `invalid API credentials`; a 403 `permission denied: …` is a real permission error. Only the first two redirect to login.
- Go responses are wrapped: `{"data": ...}`; errors are `{"message": "..."}`.
- Go is not installed on the host: run Go via `/tmp/gorun.sh '<cmd>'`, or inside the dev container with `bash -c` (not `bash -lc`, which drops Go from PATH).
- Commits: plain messages, **no Claude/Sonnet/Co-Authored-By trailer**, on branch `feat/frontend-app-shell`.
- Old admin keeps working at every commit. Do not touch other old pages.

## Review Focus

Inputs the spec implies but a happy-path run would not hit. Each has a test in the task named.

1. Session expires while the SPA is open: an API 403 `invalid session` must redirect to `/admin/login?next=<current path>`, but a 403 `permission denied` must show an error, not log the user out. Task 2.
2. Root URL with a path (`/lm`): API calls and hard links to unported pages must be `/lm/api/...` and `/lm/admin/...`. Task 2 (`apiUrl`, `hardHref` tests), Task 7 (manual check behind a prefix proxy).
3. User without `settings:get` opens `/admin/settings/logs`: Go keeps rendering its 403 page (unchanged), and the sidebar hides the Settings group for that user. Task 3 (`can`, nav tests), Task 6.
4. Language file missing a key, or non-English language: `t()` returns the key, never blank; `{name}` params are substituted. Task 3.
5. Bootstrap fails (500, network down): an error screen with a Retry button, not a blank page or an infinite spinner. Task 4.
6. Log viewer: empty log, a line that doesn't match the `timestamp file:line: message` shape, very long lines, and user scrolled up while a refresh arrives. Task 5.

---

### Task 1: Housekeeping and dependency bump

**Files:**
- Modify: `frontend/package.json`, `frontend/bun.lock` (remove unused `cn`)
- Modify (already bumped in the working tree): `tests/package.json`, `tests/bun.lock`, `static/admin/package.json`, `static/admin/bun.lock`
- Create (commit the local stub): `tests/browser.js`

**Interfaces:**
- Produces: a clean baseline on `feat/frontend-app-shell`; nothing later depends on it.

Context: `frontend/` deps were already at latest. `tests/` (Playwright 1.62 → 1.64) and `static/admin/` (CodeMirror, Alpine, Oat, Chart.js, Squire minor/patch) are bumped. `tests/browser.js` is imported by `tests/playwright.config.js` and `tests/global-setup.js` but is missing from upstream; the stub is `export const launchOptions = {};`. `.goreleaser.yml` needs no change: its `post` hook runs `make pack-bin`, which already depends on `build-frontend-app`.

- [ ] **Step 1: Drop the unused `cn` dependency**

Run (from `frontend/`): `bun remove cn`
Expected: `cn` removed from `package.json` and `bun.lock`. Confirm nothing imports it: `grep -rn "from 'cn'" src` prints nothing.

- [ ] **Step 2: Full frontend checks**

Run (from `frontend/`): `bun run lint && bun run fmt:check && bun run typecheck && bun test && bun run build`
Expected: all green.

- [ ] **Step 3: Old admin builds and the e2e suite is not worse**

Run: `cd static/admin && bun run build` → `built 26 files`. Then the full Playwright suite in the dev container (see `docs/docs/content/developer-setup.md`; `bash -c`, not `bash -lc`).
Expected: same 6 failures as `master` before the bump (5 campaign attachment/image tests, 1 subscribers bulk-action navigation flake), nothing new. Any new failure: revert the offending package in `static/admin/package.json` to its previous version and note it in the commit body.

- [ ] **Step 4: Commit**

```bash
git add tests/package.json tests/bun.lock static/admin/package.json static/admin/bun.lock
git commit -m "chore: bump Playwright and old admin dependencies"
git add frontend/package.json frontend/bun.lock tests/browser.js
git commit -m "chore: drop unused cn dependency, add Playwright browser options stub"
```

---

### Task 2: API client

**Files:**
- Create: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`
- Modify: `frontend/src/lib/basepath.ts` (add `hardHref`), `frontend/src/lib/basepath.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number }`
  - `apiUrl(root: string | undefined, path: string): string` — `/api/x` + root `/lm` → `/lm/api/x`.
  - `loginUrl(root: string | undefined, next: string): string` — `/lm/admin/login?next=%2Flm%2Fadmin%2Fsettings%2Flogs`.
  - `isAuthError(status: number, message: string): boolean` — true only for 403 with message `invalid session` or `invalid API credentials`.
  - `apiFetch<T>(path: string, init?: RequestInit, deps?: ApiDeps): Promise<T>` where `ApiDeps = { fetch: typeof fetch; root: string | undefined; redirect: (url: string) => void; currentPath: () => string }` (all default to browser values). Unwraps `{data}`; throws `ApiError` on non-2xx; on an auth error calls `deps.redirect(loginUrl(...))` and still throws.
  - `hardHref(root: string | undefined, path: string): string` in `basepath.ts` — `hardHref('/lm', '/admin/lists')` → `/lm/admin/lists`; for links that must be a full page load (unported pages).

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/api.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { ApiError, apiFetch, apiUrl, isAuthError, loginUrl, type ApiDeps } from './api';

function deps(res: Response, overrides: Partial<ApiDeps> = {}) {
  const redirects: string[] = [];
  const d: ApiDeps = {
    fetch: (async () => res) as unknown as typeof fetch,
    root: '',
    redirect: (u) => redirects.push(u),
    currentPath: () => '/admin/settings/logs',
    ...overrides,
  };
  return { d, redirects };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiUrl', () => {
  test('prefixes the root path', () => {
    expect(apiUrl('/lm', '/api/config')).toBe('/lm/api/config');
    expect(apiUrl('', '/api/config')).toBe('/api/config');
    expect(apiUrl(undefined, '/api/config')).toBe('/api/config');
  });
});

describe('loginUrl', () => {
  test('encodes the current path as next', () => {
    expect(loginUrl('', '/admin/settings/logs')).toBe(
      '/admin/login?next=%2Fadmin%2Fsettings%2Flogs',
    );
    expect(loginUrl('/lm', '/lm/admin/x')).toBe('/lm/admin/login?next=%2Flm%2Fadmin%2Fx');
  });
});

describe('isAuthError', () => {
  test('only 403 session/credential errors', () => {
    expect(isAuthError(403, 'invalid session')).toBe(true);
    expect(isAuthError(403, 'invalid API credentials')).toBe(true);
    expect(isAuthError(403, 'permission denied: settings:get')).toBe(false);
    expect(isAuthError(500, 'invalid session')).toBe(false);
  });
});

describe('apiFetch', () => {
  test('unwraps {data}', async () => {
    const { d } = deps(json(200, { data: { a: 1 } }));
    expect(await apiFetch('/api/x', undefined, d)).toEqual({ a: 1 });
  });

  test('calls the prefixed URL with credentials and JSON accept', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const { d } = deps(json(200, { data: 1 }), {
      root: '/lm',
      fetch: (async (url: string, init?: RequestInit) => {
        seen = { url, init };
        return json(200, { data: 1 });
      }) as unknown as typeof fetch,
    });
    await apiFetch('/api/x', undefined, d);
    expect(seen?.url).toBe('/lm/api/x');
    expect(seen?.init?.credentials).toBe('same-origin');
    expect((seen?.init?.headers as Record<string, string>).Accept).toBe('application/json');
  });

  test('throws ApiError with the server message', async () => {
    const { d, redirects } = deps(json(500, { message: 'boom' }));
    const err = await apiFetch('/api/x', undefined, d).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe('boom');
    expect(redirects).toEqual([]);
  });

  test('non-JSON error body falls back to the status text', async () => {
    const { d } = deps(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    const err = await apiFetch('/api/x', undefined, d).catch((e) => e);
    expect(err.message).toBe('Bad Gateway');
  });

  test('redirects to login on an expired session, keeps the throw', async () => {
    const { d, redirects } = deps(json(403, { message: 'invalid session' }));
    await expect(apiFetch('/api/x', undefined, d)).rejects.toBeInstanceOf(ApiError);
    expect(redirects).toEqual(['/admin/login?next=%2Fadmin%2Fsettings%2Flogs']);
  });

  test('permission denied does not redirect', async () => {
    const { d, redirects } = deps(json(403, { message: 'permission denied: settings:get' }));
    await expect(apiFetch('/api/x', undefined, d)).rejects.toBeInstanceOf(ApiError);
    expect(redirects).toEqual([]);
  });
});
```

Append to `frontend/src/lib/basepath.test.ts`:

```ts
import { hardHref } from './basepath';

describe('hardHref', () => {
  test('prefixes the root path', () => {
    expect(hardHref('/lm', '/admin/lists')).toBe('/lm/admin/lists');
    expect(hardHref('', '/admin/lists')).toBe('/admin/lists');
    expect(hardHref(undefined, '/admin/lists')).toBe('/admin/lists');
  });
});
```

(If `describe`/`test` are already imported at the top of that file, add only `hardHref` to the existing import from `./basepath`.)

- [ ] **Step 2: Run to verify failure**

Run (from `frontend/`): `bun test src/lib/api.test.ts src/lib/basepath.test.ts`
Expected: FAIL — `Cannot find module './api'` / `hardHref` is not exported.

- [ ] **Step 3: Implement**

Add to `frontend/src/lib/basepath.ts`:

```ts
// href for a link that must be a full page load (an unported page served by Go).
export function hardHref(root: string | undefined, path: string): string {
  return (root ?? '') + path;
}
```

`frontend/src/lib/api.ts`:

```ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiDeps {
  fetch: typeof fetch;
  root: string | undefined;
  redirect: (url: string) => void;
  currentPath: () => string;
}

const browserDeps = (): ApiDeps => ({
  fetch: window.fetch.bind(window),
  root: window._LM_ROOT,
  redirect: (url) => window.location.assign(url),
  currentPath: () => window.location.pathname + window.location.search,
});

export const apiUrl = (root: string | undefined, path: string): string => (root ?? '') + path;

export const loginUrl = (root: string | undefined, next: string): string =>
  `${root ?? ''}/admin/login?next=${encodeURIComponent(next)}`;

// Go answers an unauthenticated API call with 403 + one of these messages. Any other
// 403 ("permission denied: …") is a real permission error and must not log the user out.
export const isAuthError = (status: number, message: string): boolean =>
  status === 403 && (message === 'invalid session' || message === 'invalid API credentials');

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  deps: ApiDeps = browserDeps(),
): Promise<T> {
  const res = await deps.fetch(apiUrl(deps.root, path), {
    credentials: 'same-origin',
    ...init,
    headers: { Accept: 'application/json', ...(init.headers as Record<string, string>) },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // not JSON; keep the status text
    }
    if (isAuthError(res.status, message)) {
      deps.redirect(loginUrl(deps.root, deps.currentPath()));
    }
    throw new ApiError(res.status, message);
  }

  return ((await res.json()) as { data: T }).data;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/lib/api.test.ts src/lib/basepath.test.ts`
Expected: PASS.

- [ ] **Step 5: Checks and commit**

Run: `bun run lint && bun run fmt:check && bun run typecheck`

```bash
git add frontend/src/lib
git commit -m "feat(frontend): add API client with login redirect on expired session"
```

---

### Task 3: i18n, permissions and navigation model

**Files:**
- Create: `frontend/src/lib/i18n.ts`, `frontend/src/lib/permissions.ts`, `frontend/src/lib/nav.ts`
- Test: `frontend/src/lib/i18n.test.ts`, `frontend/src/lib/permissions.test.ts`, `frontend/src/lib/nav.test.ts`

**Interfaces:**
- Produces:
  - `i18n.ts`: `type Translate = (key: string, params?: Record<string, string | number>) => string`; `createT(dict: Record<string, string>): Translate`. Missing key → the key. `{name}` replaced by `params.name`.
  - `permissions.ts`: `interface AppUser { id: number; username: string; name: string; email: string | null; avatar: string | null; user_role: { id: number; name: string; permissions: string[] } }`; `const SUPER_ADMIN_ROLE_ID = 1`; `can(user: AppUser, ...perms: string[]): boolean` — mirrors Go `can()` in `cmd/views.go`: super admin (role id 1) always true; a perm ending in `*` matches any held permission with that prefix; otherwise exact match; true if any of `perms` matches; false when `perms` is empty.
  - `nav.ts`: `interface NavItem { key: string; label: string /* i18n key */; path: string /* browser path under /admin, may include ?query */; perms: string[] /* any-of; empty = always */; ported: boolean }`; `interface NavGroup { key: string; label: string; icon: string; items: NavItem[] }`; `NAV: NavGroup[]`; `visibleNav(user: AppUser): NavGroup[]` — items filtered by `can`, empty groups dropped.
  - Dashboard is a top-level link, not a group: model it as a group with one item and `icon: 'grid'`; the sidebar renders single-item groups as a plain link.

- [ ] **Step 1: Write the failing tests**

`i18n.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createT } from './i18n';

describe('createT', () => {
  const t = createT({ 'logs.title': 'Logs', 'x.hello': 'Hello {name}, {count} new' });

  test('looks up a key', () => expect(t('logs.title')).toBe('Logs'));
  test('missing key returns the key', () => expect(t('nope.key')).toBe('nope.key'));
  test('substitutes params', () =>
    expect(t('x.hello', { name: 'Ana', count: 3 })).toBe('Hello Ana, 3 new'));
  test('leaves unknown placeholders intact', () =>
    expect(t('x.hello', { name: 'Ana' })).toBe('Hello Ana, {count} new'));
});
```

`permissions.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { can, type AppUser } from './permissions';

const user = (roleId: number, permissions: string[]): AppUser => ({
  id: 2,
  username: 'u',
  name: 'U',
  email: null,
  avatar: null,
  user_role: { id: roleId, name: 'r', permissions },
});

describe('can', () => {
  test('super admin can everything', () => expect(can(user(1, []), 'settings:get')).toBe(true));
  test('exact match', () => {
    const u = user(2, ['settings:get']);
    expect(can(u, 'settings:get')).toBe(true);
    expect(can(u, 'settings:manage')).toBe(false);
  });
  test('any-of', () => expect(can(user(2, ['b:get']), 'a:get', 'b:get')).toBe(true));
  test('prefix wildcard', () => {
    expect(can(user(2, ['campaigns:get_all']), 'campaigns:*')).toBe(true);
    expect(can(user(2, ['lists:get_all']), 'campaigns:*')).toBe(false);
  });
  test('no perms asked is false', () => expect(can(user(2, ['a']))).toBe(false));
});
```

`nav.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { NAV, visibleNav } from './nav';
import type { AppUser } from './permissions';

const user = (roleId: number, permissions: string[]): AppUser => ({
  id: 2,
  username: 'u',
  name: 'U',
  email: null,
  avatar: null,
  user_role: { id: roleId, name: 'r', permissions },
});

const itemKeys = (u: AppUser) => visibleNav(u).flatMap((g) => g.items.map((i) => i.key));

describe('visibleNav', () => {
  test('super admin sees every item', () => {
    const all = NAV.flatMap((g) => g.items.map((i) => i.key));
    expect(itemKeys(user(1, []))).toEqual(all);
  });

  test('a user with no permissions sees only ungated items', () => {
    const keys = itemKeys(user(2, []));
    expect(keys).toContain('dashboard');
    expect(keys).not.toContain('settings.logs');
  });

  test('empty groups are dropped', () => {
    const groups = visibleNav(user(2, [])).map((g) => g.key);
    expect(groups).not.toContain('settings');
    expect(groups).not.toContain('users');
  });

  test('settings:get shows logs but not maintenance', () => {
    const keys = itemKeys(user(2, ['settings:get']));
    expect(keys).toContain('settings.logs');
    expect(keys).not.toContain('settings.maintenance');
  });

  test('only logs is ported so far', () => {
    const ported = NAV.flatMap((g) => g.items).filter((i) => i.ported).map((i) => i.key);
    expect(ported).toEqual(['settings.logs']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/lib/i18n.test.ts src/lib/permissions.test.ts src/lib/nav.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`i18n.ts`:

```ts
export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function createT(dict: Record<string, string>): Translate {
  return (key, params) => {
    const s = dict[key];
    if (s === undefined) return key;
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in params ? String(params[name]) : m,
    );
  };
}
```

`permissions.ts`:

```ts
export const SUPER_ADMIN_ROLE_ID = 1;

export interface AppUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  avatar: string | null;
  user_role: { id: number; name: string; permissions: string[] };
}

// Mirrors `can` in cmd/views.go: any-of, "prefix*" wildcard, super admin short-circuit.
export function can(user: AppUser, ...perms: string[]): boolean {
  if (user.user_role.id === SUPER_ADMIN_ROLE_ID) return true;
  const held = user.user_role.permissions;
  return perms.some((p) =>
    p.endsWith('*') ? held.some((h) => h.startsWith(p.slice(0, -1))) : held.includes(p),
  );
}
```

`nav.ts` (permission lists copied from `static/admin/partials/sidebar.html`; the group-level gates there are the union of their items' gates plus a few extras, which `visibleNav`'s empty-group drop reproduces for the items that exist in the sidebar):

```ts
import { can, type AppUser } from './permissions';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  perms: string[];
  ported: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const item = (key: string, label: string, path: string, perms: string[] = [], ported = false) => ({
  key,
  label,
  path,
  perms,
  ported,
});

export const NAV: NavGroup[] = [
  {
    key: 'dashboard',
    label: 'menu.dashboard',
    icon: 'grid',
    items: [item('dashboard', 'menu.dashboard', '/admin')],
  },
  {
    key: 'lists',
    label: 'globals.terms.lists',
    icon: 'list',
    items: [
      item('lists.all', 'menu.allLists', '/admin/lists'),
      item('lists.archived', 'lists.archived', '/admin/lists?status=archived'),
      item('lists.analytics', 'globals.terms.analytics', '/admin/lists/analytics'),
      item('lists.forms', 'menu.forms', '/admin/lists/forms'),
    ],
  },
  {
    key: 'subscribers',
    label: 'globals.terms.subscribers',
    icon: 'at-sign',
    items: [
      item('subscribers.all', 'menu.allSubscribers', '/admin/subscribers', [
        'subscribers:get',
        'subscribers:get_all',
      ]),
      item('subscribers.import', 'menu.import', '/admin/subscribers/import', [
        'subscribers:import',
      ]),
      item('subscribers.bounces', 'globals.terms.bounces', '/admin/subscribers/bounces', [
        'bounces:get',
      ]),
    ],
  },
  {
    key: 'campaigns',
    label: 'globals.terms.campaigns',
    icon: 'send',
    items: [
      item('campaigns.all', 'menu.allCampaigns', '/admin/campaigns', [
        'campaigns:get',
        'campaigns:get_all',
      ]),
      item('campaigns.new', 'menu.newCampaign', '/admin/campaigns/new', [
        'campaigns:manage',
        'campaigns:manage_all',
      ]),
      item('campaigns.media', 'menu.media', '/admin/campaigns/media', [
        'media:get',
        'media:manage',
      ]),
      item('campaigns.templates', 'globals.terms.templates', '/admin/templates', [
        'templates:get',
      ]),
      item('campaigns.analytics', 'globals.terms.analytics', '/admin/campaigns/analytics', [
        'campaigns:get_analytics',
      ]),
    ],
  },
  {
    key: 'users',
    label: 'globals.terms.users',
    icon: 'users',
    items: [
      item('users.users', 'globals.terms.users', '/admin/users', ['users:get']),
      item('users.user-roles', 'users.userRoles', '/admin/users/roles', ['roles:get']),
      item('users.list-roles', 'users.listRoles', '/admin/users/roles/lists', ['roles:get']),
    ],
  },
  {
    key: 'settings',
    label: 'menu.settings',
    icon: 'settings',
    items: [
      item('settings.all', 'menu.settings', '/admin/settings', ['settings:get']),
      item('settings.logs', 'menu.logs', '/admin/settings/logs', ['settings:get'], true),
      item('settings.maintenance', 'menu.maintenance', '/admin/settings/maintenance', [
        'settings:maintain',
      ]),
    ],
  },
];

export function visibleNav(user: AppUser): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.perms.length === 0 || can(user, ...i.perms)),
  })).filter((g) => g.items.length > 0);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test`
Expected: PASS (all earlier tests too).

- [ ] **Step 5: Checks and commit**

Run: `bun run lint && bun run fmt:check && bun run typecheck`

```bash
git add frontend/src/lib
git commit -m "feat(frontend): add i18n, permissions and navigation model"
```

---

### Task 4: Bootstrap loading and the `_app` layout route

**Files:**
- Modify: `frontend/package.json` (add `@tanstack/react-query`)
- Create: `frontend/src/lib/bootstrap.ts`, `frontend/src/components/bootstrap-error.tsx`, `frontend/src/routes/_app.tsx`, `frontend/src/components/app-context.tsx`
- Test: `frontend/src/lib/bootstrap.test.ts`
- Modify: `frontend/src/router.tsx` (QueryClient in router context), `frontend/src/routes/__root.tsx` (`createRootRouteWithContext`)

**Interfaces:**
- Consumes: `apiFetch` (Task 2), `createT`/`Translate` (Task 3), `AppUser`/`can` (Task 3).
- Produces:
  - `bootstrap.ts`: `interface ServerConfig { root_url: string; lang: string; version: string; messengers: string[]; needs_restart: boolean; has_legacy_user: boolean; update: unknown | null; [k: string]: unknown }`; `interface Bootstrap { config: ServerConfig; user: AppUser; messages: Record<string, string> }`; `loadBootstrap(fetchJson?: typeof apiFetch): Promise<Bootstrap>` — config and profile in parallel, then `/api/lang/${config.lang}`; `bootstrapQuery` (`queryOptions` with `queryKey: ['bootstrap']`, `staleTime: Infinity`, `retry: false`).
  - `app-context.tsx`: `AppProvider({ value: Bootstrap, children })`; hooks `useApp(): Bootstrap`, `useT(): Translate`, `useCan(): (...perms: string[]) => boolean`.
  - `_app.tsx`: pathless layout. `beforeLoad` → `context.queryClient.ensureQueryData(bootstrapQuery)`; `errorComponent` → `BootstrapError` (message + Retry button that invalidates `['bootstrap']` and calls `router.invalidate()`); `pendingComponent` → a centered spinner; `component` renders `<AppProvider>` + `<Outlet />` (the sidebar layout arrives in Task 5).
  - Router context type: `{ queryClient: QueryClient }`.

- [ ] **Step 1: Add the dependency**

Run (from `frontend/`): `bun add @tanstack/react-query`

- [ ] **Step 2: Write the failing test**

`frontend/src/lib/bootstrap.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { loadBootstrap } from './bootstrap';

type Call = string;

function fakeFetch(map: Record<string, unknown>, calls: Call[] = []) {
  return (async (path: string) => {
    calls.push(path);
    if (!(path in map)) throw new Error(`unexpected ${path}`);
    const v = map[path];
    if (v instanceof Error) throw v;
    return v;
  }) as never;
}

describe('loadBootstrap', () => {
  test('combines config, profile and the configured language', async () => {
    const calls: Call[] = [];
    const out = await loadBootstrap(
      fakeFetch(
        {
          '/api/config': { lang: 'fr', version: 'v1' },
          '/api/profile': { id: 1, username: 'a' },
          '/api/lang/fr': { 'logs.title': 'Journaux' },
        },
        calls,
      ),
    );
    expect(out.config.lang).toBe('fr');
    expect(out.user.username).toBe('a');
    expect(out.messages['logs.title']).toBe('Journaux');
    expect(calls.slice(0, 2).sort()).toEqual(['/api/config', '/api/profile']);
    expect(calls[2]).toBe('/api/lang/fr');
  });

  test('a failed call rejects the whole bootstrap', async () => {
    await expect(
      loadBootstrap(
        fakeFetch({
          '/api/config': new Error('down'),
          '/api/profile': { id: 1 },
        }),
      ),
    ).rejects.toThrow('down');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun test src/lib/bootstrap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`frontend/src/lib/bootstrap.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { AppUser } from './permissions';

export interface ServerConfig {
  root_url: string;
  lang: string;
  version: string;
  messengers: string[];
  needs_restart: boolean;
  has_legacy_user: boolean;
  update: unknown | null;
  [k: string]: unknown;
}

export interface Bootstrap {
  config: ServerConfig;
  user: AppUser;
  messages: Record<string, string>;
}

export async function loadBootstrap(fetchJson: typeof apiFetch = apiFetch): Promise<Bootstrap> {
  const [config, user] = await Promise.all([
    fetchJson<ServerConfig>('/api/config'),
    fetchJson<AppUser>('/api/profile'),
  ]);
  const messages = await fetchJson<Record<string, string>>(`/api/lang/${config.lang}`);
  return { config, user, messages };
}

export const bootstrapQuery = queryOptions({
  queryKey: ['bootstrap'],
  queryFn: () => loadBootstrap(),
  staleTime: Infinity,
  retry: false,
});
```

`frontend/src/components/app-context.tsx`:

```tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Bootstrap } from '@/lib/bootstrap';
import { createT, type Translate } from '@/lib/i18n';
import { can } from '@/lib/permissions';

interface AppValue extends Bootstrap {
  t: Translate;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ value, children }: { value: Bootstrap; children: ReactNode }) {
  const v = useMemo(() => ({ ...value, t: createT(value.messages) }), [value]);
  return <AppContext.Provider value={v}>{children}</AppContext.Provider>;
}

function useAppValue(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export const useApp = (): Bootstrap => useAppValue();
export const useT = (): Translate => useAppValue().t;
export function useCan(): (...perms: string[]) => boolean {
  const { user } = useAppValue();
  return (...perms) => can(user, ...perms);
}
```

`frontend/src/components/bootstrap-error.tsx`:

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function BootstrapError({ error }: { error: Error }) {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Could not load listmonk</h1>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button
        onClick={async () => {
          await qc.invalidateQueries({ queryKey: ['bootstrap'] });
          await router.invalidate();
        }}
      >
        Retry
      </Button>
    </main>
  );
}
```

`frontend/src/routes/_app.tsx`:

```tsx
import { useSuspenseQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { AppProvider } from '@/components/app-context';
import { BootstrapError } from '@/components/bootstrap-error';
import { bootstrapQuery } from '@/lib/bootstrap';

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => context.queryClient.ensureQueryData(bootstrapQuery),
  errorComponent: ({ error }) => <BootstrapError error={error} />,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <div className="border-muted-foreground size-6 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  ),
  component: AppLayout,
});

function AppLayout() {
  const { data } = useSuspenseQuery(bootstrapQuery);
  return (
    <AppProvider value={data}>
      <Outlet />
    </AppProvider>
  );
}
```

`frontend/src/router.tsx`: create a `QueryClient` per router and pass it as context:

```tsx
import { QueryClient } from '@tanstack/react-query';
// …existing imports…

export function getRouter() {
  const queryClient = new QueryClient();
  return createRouter({
    routeTree,
    context: { queryClient },
    // …existing options unchanged (rewrite, scrollRestoration, defaultNotFoundComponent)…
  });
}
```

(Read the current `router.tsx` first and add only the `context` and the `QueryClient`; keep every existing option.)

`frontend/src/routes/__root.tsx`: switch `createRootRoute({...})` to `createRootRouteWithContext<{ queryClient: QueryClient }>()({...})`. In `RootDocument`, read the client with `Route.useRouteContext()` and wrap `{children}` in `<QueryClientProvider client={queryClient}>` (inside `ThemeProvider`). The provider must live in the root shell, not in `_app`, so that `BootstrapError` (rendered by `_app`'s error boundary, outside `AppLayout`) can still call `useQueryClient()`.

- [ ] **Step 5: Run to verify pass, then build**

Run: `bun test && bun run typecheck && bun run build`
Expected: PASS; `routeTree.gen.ts` regenerates with `/_app`.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat(frontend): load bootstrap data and add the _app layout route"
```

---

### Task 5: Sidebar layout, user menu, theme toggle

**Files:**
- Modify: `frontend/package.json` (via shadcn), `frontend/src/styles.css` (only if shadcn adds sidebar tokens that are missing)
- Create (via `bunx shadcn@latest add`): `src/components/ui/{sidebar,sheet,tooltip,skeleton,separator,avatar,collapsible,sonner}.tsx` and `src/hooks/use-mobile.ts`
- Modify: `src/components/ui/sonner.tsx` (use our `useTheme`)
- Create: `src/components/app-sidebar.tsx`, `src/components/user-menu.tsx`, `src/components/page-header.tsx`, `src/components/nav-icon.tsx`
- Modify: `src/components/theme-toggle.tsx` (labels via `useT`), `src/routes/_app.tsx` (render the layout)

**Interfaces:**
- Consumes: `useApp`, `useT`, `useCan` (Task 4); `visibleNav`, `NavGroup`, `NavItem` (Task 3); `hardHref` (Task 2); `ThemeToggle`; `apiFetch`.
- Produces: `PageHeader({ title, description?, actions? })`; the `_app` layout renders `SidebarProvider` + `AppSidebar` + `SidebarInset` (header with `SidebarTrigger`, content `Outlet`) + `<Toaster />`.

This task is visual; the acceptance is a screenshot review in light and dark, desktop and mobile width, not unit tests.

- [ ] **Step 1: Generate the shadcn components**

Run (from `frontend/`): `bunx shadcn@latest add sidebar sheet tooltip skeleton separator avatar collapsible sonner`
Expected: files under `src/components/ui/`, `src/hooks/use-mobile.ts`; new deps in `package.json` (`sonner` etc.). The CLI may ask to overwrite existing `button.tsx` etc.: answer no.

- [ ] **Step 2: Point `sonner` at our theme**

The generated `src/components/ui/sonner.tsx` imports `useTheme` from `next-themes`. Replace that import with `import { useTheme } from '@/components/theme-provider';` and pass `theme={theme}` (our values are `light` / `dark` / `system`, which Sonner accepts). Remove `next-themes` from `package.json` if the CLI added it: `bun remove next-themes`.

- [ ] **Step 3: Nav icons**

`src/components/nav-icon.tsx` maps the `icon` string in `NavGroup` to a lucide component:

```tsx
import { AtSign, LayoutGrid, List, Send, Settings, Users, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  list: List,
  'at-sign': AtSign,
  send: Send,
  users: Users,
  settings: Settings,
};

export function NavIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? List;
  return <Icon />;
}
```

- [ ] **Step 4: Sidebar**

`src/components/app-sidebar.tsx`. Behaviour to implement, using the shadcn `Sidebar*` primitives and `Collapsible` for groups:

- Header: listmonk logo (`/admin/static/logo.svg` through `hardHref`; it is served by Go) linking to the dashboard with `hardHref`.
- Content: `visibleNav(user)` mapped to groups. A single-item group renders one `SidebarMenuButton` link. Multi-item groups render a collapsible group, open when one of its items matches the current location.
- Link kind: `item.ported` → TanStack `<Link to={...}>` using the router path (the item's `path` minus the leading `/admin`, e.g. `/settings/logs`); otherwise `<a href={hardHref(window._LM_ROOT, item.path)}>`. Active state: for ported items use the router's `activeProps`; unported items are never active in this shell (the old Go page renders them).
- Labels: `t(item.label)`.
- Footer: `<UserMenu />`.

`src/components/user-menu.tsx`: a `DropdownMenu` in the sidebar footer showing the avatar (fallback: initials from `user.name || user.username`), name, and items: Profile (`hardHref(root, '/admin/user/profile')`, label `t('users.profile')`), the three theme options (labels `t('globals.terms.system')`, `t('users.themeLight')`, `t('users.themeDark')`, using `useTheme().setTheme`), and Log out (`t('users.logout')`): `apiFetch('/api/logout', { method: 'POST' })` then `window.location.assign(hardHref(root, '/admin/login'))`. Replace the standalone `ThemeToggle` usage; keep `theme-toggle.tsx` only if still imported, else delete it.

`src/components/page-header.tsx`:

```tsx
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```

`src/routes/_app.tsx` `AppLayout` becomes:

```tsx
<AppProvider value={data}>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header className="flex h-12 items-center gap-2 border-b px-4">
        <SidebarTrigger />
      </header>
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </SidebarInset>
  </SidebarProvider>
  <Toaster />
</AppProvider>
```

- [ ] **Step 5: Verify visually**

Run the app per `docs/docs/content/developer-setup.md` (dev stack) or serve the build, open any `_app` child route (Task 6 adds the first; until then add a temporary `src/routes/_app/index.tsx`-less check by visiting `/admin/settings/logs` after Task 6). If verifying before Task 6, use the dev server and a throwaway route and delete it before committing.
Check, in light and dark: sidebar contrast, active state, collapsed groups, user menu, theme switch, 375px width (sidebar becomes a sheet), keyboard focus rings, no console errors.

- [ ] **Step 6: Checks and commit**

Run: `bun run lint && bun run fmt:check && bun run typecheck && bun test && bun run build`

```bash
git add frontend
git commit -m "feat(frontend): add app layout with sidebar, user menu and theme switch"
```

---

### Task 6: Port the log viewer and flip the Go route

**Files:**
- Create: `frontend/src/lib/logs.ts`, `frontend/src/lib/logs.test.ts`, `frontend/src/routes/_app/settings/logs.tsx`, `frontend/src/components/log-view.tsx`
- Modify: `cmd/handlers.go:131` (route), `cmd/settings.go` (remove `logsView`, `ViewLogs`), `static/admin/views/logs.html` (delete), `static/admin/assets/js/views/logs.js` (delete), `static/admin/build.mjs` only if it lists views explicitly, `static/admin/i18n.txt` (leave)
- Delete: `frontend/src/routes/next.tsx`; Modify: `cmd/handlers.go` (remove the `/admin/next` route), `tests/specs/frontend-foundation.spec.js` (repoint to the logs route), `internal/adminapp`/docs references to `/admin/next` if any (`grep -rn "admin/next"`)
- Test: `frontend/src/lib/logs.test.ts`, `tests/specs/logs.spec.js`

**Interfaces:**
- Consumes: `apiFetch`, `useT`, `PageHeader`, TanStack Query.
- Produces:
  - `logs.ts`: `interface LogLine { timestamp: string; file: string; message: string }`; `parseLogLine(raw: string): LogLine` — same regexp as the old `logs.js`: `^([0-9\s:/]+\.[0-9]{6}) (.+?\.go:[0-9]+|\*):\s(.+)$`; non-matching lines become `{ timestamp: '', file: '', message: raw }`; `parseLogLines(raw: string[]): LogLine[]` drops empty lines; `isErrorLine(l: LogLine): boolean` — message contains `error` (case-sensitive, as before).
  - `log-view.tsx`: `LogView({ lines }: { lines: LogLine[] })` — monospace scroll container; sticks to bottom on new data only if the user was already within 40px of the bottom.
  - Route `/settings/logs`: `useQuery({ queryKey: ['logs'], queryFn: () => apiFetch<string[]>('/api/logs'), refetchInterval: 10_000 })`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/logs.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { isErrorLine, parseLogLine, parseLogLines } from './logs';

describe('parseLogLine', () => {
  test('splits timestamp, file and message', () => {
    expect(parseLogLine('2021/05/01 00:00:00.123456 init.go:99: reading config: config.toml')).toEqual({
      timestamp: '2021/05/01 00:00:00.123456',
      file: 'init.go:99',
      message: 'reading config: config.toml',
    });
  });

  test('"*" as the file', () => {
    expect(parseLogLine('2021/05/01 00:00:00.123456 *: hello').file).toBe('*');
  });

  test('a line that does not match is kept whole as the message', () => {
    expect(parseLogLine('panic: something odd')).toEqual({
      timestamp: '',
      file: '',
      message: 'panic: something odd',
    });
  });
});

describe('parseLogLines', () => {
  test('drops empty lines', () => {
    expect(parseLogLines(['', 'a', ''])).toHaveLength(1);
  });
  test('empty input', () => expect(parseLogLines([])).toEqual([]));
});

describe('isErrorLine', () => {
  test('flags messages containing "error"', () => {
    expect(isErrorLine({ timestamp: '', file: '', message: 'error sending' })).toBe(true);
    expect(isErrorLine({ timestamp: '', file: '', message: 'all fine' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/lib/logs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

`frontend/src/lib/logs.ts`:

```ts
export interface LogLine {
  timestamp: string;
  file: string;
  message: string;
}

// 2021/05/01 00:00:00.123456 init.go:99: reading config: config.toml
const RE_LINE = /^([0-9\s:/]+\.[0-9]{6}) (.+?\.go:[0-9]+|\*):\s(.+)$/;

export function parseLogLine(raw: string): LogLine {
  const m = RE_LINE.exec(raw);
  return m ? { timestamp: m[1], file: m[2], message: m[3] } : { timestamp: '', file: '', message: raw };
}

export const parseLogLines = (raw: string[]): LogLine[] => raw.filter(Boolean).map(parseLogLine);

export const isErrorLine = (l: LogLine): boolean => l.message.includes('error');
```

Run: `bun test src/lib/logs.test.ts` → PASS.

- [ ] **Step 4: Component and route**

`frontend/src/components/log-view.tsx`:

```tsx
import { useLayoutEffect, useRef } from 'react';
import { isErrorLine, type LogLine } from '@/lib/logs';
import { cn } from '@/lib/utils';

const STICKY_PX = 40;

export function LogView({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_PX;
      }}
      className="bg-muted/40 h-[calc(100svh-14rem)] min-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed"
      role="log"
      aria-live="off"
    >
      {lines.map((l, i) => (
        <div key={i} className="break-words">
          {l.timestamp ? <span className="text-muted-foreground">{l.timestamp} </span> : null}
          {l.file && l.file !== '*' ? <span className="text-muted-foreground">{l.file}: </span> : null}
          <span className={cn(isErrorLine(l) && 'text-destructive')}>{l.message}</span>
        </div>
      ))}
    </div>
  );
}
```

`frontend/src/routes/_app/settings/logs.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useT } from '@/components/app-context';
import { LogView } from '@/components/log-view';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { parseLogLines } from '@/lib/logs';

export const Route = createFileRoute('/_app/settings/logs')({
  head: () => ({ meta: [{ title: 'Logs - listmonk' }] }),
  component: LogsPage,
});

function LogsPage() {
  const t = useT();
  const { data, error, isPending } = useQuery({
    queryKey: ['logs'],
    queryFn: () => apiFetch<string[]>('/api/logs'),
    refetchInterval: 10_000,
  });
  const lines = useMemo(() => parseLogLines(data ?? []), [data]);

  return (
    <>
      <PageHeader title={t('logs.title')} />
      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : (
        <LogView lines={lines} />
      )}
    </>
  );
}
```

(A refresh that fails after data was loaded keeps showing the last lines: `error` is only rendered when no data exists; adjust the ternary to `!data && error` if the typecheck shows both set.)

- [ ] **Step 5: Flip the Go route and remove the old view**

In `cmd/handlers.go` change line 131 to:

```go
g.GET(path.Join(uriAdmin, "/settings/logs"), pm(a.ServeAdminApp, "settings:get"))
```

Delete `logsView` and `ViewLogs` from `cmd/settings.go` (keep `GetLogs`), delete `static/admin/views/logs.html` and `static/admin/assets/js/views/logs.js`. Check `static/admin/build.mjs` and `grep -rn "views/logs\|admin-logs\|logsView" static cmd` for remaining references and remove them.

- [ ] **Step 6: Remove the demo page and repoint the foundation spec**

Delete `frontend/src/routes/next.tsx` and the `/admin/next` route in `cmd/handlers.go`. In `tests/specs/frontend-foundation.spec.js` replace `/admin/next` with `/admin/settings/logs` and the heading assertion with the logs page heading (`getByRole('heading', { name: 'Logs' })`); the unauthenticated redirect assertion becomes `/admin/login?next=%2Fadmin%2Fsettings%2Flogs`. Run `bun run build` to regenerate `routeTree.gen.ts`.

- [ ] **Step 7: E2E spec for the page**

`tests/specs/logs.spec.js` — follow the style and login fixtures of `tests/specs/frontend-foundation.spec.js`. Cases:

1. Logs page shows heading `Logs` and at least one log line (the instance logs on startup).
2. Sidebar shows `Logs` under Settings; clicking `Lists` (unported) performs a full page load to the old `/admin/lists` (assert URL and that `window.__TSR_ROUTER__`-free old page content, e.g. the `Lists` heading, renders).
3. Dark: `emulateMedia({ colorScheme: 'dark' })` with no stored theme → `html` has class `dark`; no console errors on load in either scheme.
4. Mobile viewport (375×812): sidebar trigger opens the sheet and shows nav.

Expected selectors come from roles and labels, not CSS classes.

- [ ] **Step 8: Verify**

Run: Go build and vet via `/tmp/gorun.sh 'go build ./... && go vet ./cmd/... ./internal/adminapp/... && go test ./internal/...'`; frontend `bun run lint && bun run fmt:check && bun run typecheck && bun test && bun run build`; then the e2e specs `frontend-foundation` and `logs` in the dev container, then the full suite once.
Expected: all green; full suite has only the 6 known failures.

- [ ] **Step 9: Commit**

```bash
git add -A frontend cmd static tests
git commit -m "feat: port the log viewer to the new admin and drop the demo page"
```

---

### Task 7: Sub-path, permission and failure checks, docs, PR

**Files:**
- Modify: `docs/docs/content/developer-setup.md`
- Modify: `.github/workflows/frontend.yml` only if a new script is needed (it is not)

- [ ] **Step 1: Sub-path check**

Reuse the harness from the foundation work: a reverse proxy that strips `/lm` in front of Go with `app.root_url` set to `http://host/lm` in the DB settings (it is not overridable by env). Open `/lm/admin/settings/logs` in a browser.
Expected: page renders, `/lm/api/config`, `/lm/api/profile`, `/lm/api/lang/en`, `/lm/api/logs` all 200, the Lists link points at `/lm/admin/lists`, zero failed requests, zero console errors.

- [ ] **Step 2: Permission and session checks**

Create a user whose role lacks `settings:get`:
- `/admin/settings/logs` → Go's permission-denied page (unchanged); the SPA is not served.
- A user with only `lists:get_all`: the sidebar shows no Subscribers, Campaigns, Users or Settings groups.
Delete the session cookie while the logs page is open and wait for the next refresh (or trigger one by reloading the query): the browser lands on `/admin/login?next=...`.

- [ ] **Step 3: Failure screen**

Stop the Go server (or block `/api/config` in the browser devtools) and reload the logs page.
Expected: "Could not load listmonk" with the error and a Retry button; after restoring, Retry loads the page.

- [ ] **Step 4: Docs**

In the "New admin frontend (`frontend/`)" section of `docs/docs/content/developer-setup.md`: replace the `/admin/next` instructions with `/admin/settings/logs`, and add a short "Porting a page" checklist: add the route under `src/routes/_app/`, flip the Go route to `a.ServeAdminApp` (keep its `pm(...)` permission), set `ported: true` on the item in `src/lib/nav.ts`, delete the old template/JS, update or add the Playwright spec, verify both themes.

- [ ] **Step 5: Final verification, push, PR**

Run the full frontend checks, `/tmp/gorun.sh 'go test ./...'`, and the full Playwright suite. Then push `feat/frontend-app-shell` and open a PR against the fork's own `master` (`gh pr create --repo malkhatib416/listmonk-shadcn --base master`), no Claude trailer in commits or body, and register it with `link_pull_request`.
