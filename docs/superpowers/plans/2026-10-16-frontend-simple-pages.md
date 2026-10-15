# Admin Frontend: shared kit + Users, Roles, Profile, Maintenance

> Task-level plan (design, interfaces, tests). Code lives in the commits. Execute inline; one commit per task.

**Goal:** Build the reusable page kit (data table, confirm dialog, status badge, empty state, form fields, mutation helper) and port the user-management pages and Maintenance with it, so later page groups (lists, subscribers, campaigns, settings) reuse the kit unchanged.

**Spec:** `docs/superpowers/specs/2026-10-15-frontend-migration-design.md` (rollout step 3). Builds on `2026-10-15-frontend-app-shell.md`.

**Design:** Resend/Notion style, listmonk blue, comfortable density (see `frontend/src/styles.css`). Every page checked in light, dark and 375px.

## Decisions

- **Tables:** `@tanstack/react-table` (headless) rendered with shadcn `Table`. Sorting, selection and filtering are client side for `/api/users` and `/api/roles/*` (they return everything; the old pages filtered in SQL only because they were server-rendered). Lists with server pagination (subscribers, campaigns) get a `serverPagination` mode in the next plan.
- **Forms:** `react-hook-form` + `zod` through shadcn `Form` primitives.
- **Mutations:** `useApiMutation` wraps `useMutation`: success toast (i18n `globals.messages.created|updated|deleted`), query invalidation, error toast with the server message.
- **URL state:** list filters live in TanStack Router search params so filtered views are linkable (the old admin used `?type=api`).
- **Go:** each ported route flips to `a.ServeAdminApp` with its `pm(...)` check kept; old view, template and JS deleted. `message` (permission error page) stays a Go page.
- **Permissions:** pages hide actions with `useCan()`; the API stays authoritative.

## Review Focus

1. Super admin role (id 1) is read-only in the role form and cannot be deleted; last admin user cannot be deleted (server enforces, UI must surface the error).
2. API users: password fields hidden, one-time token shown once after creation, never again.
3. Role form with zero permissions, a list role with zero lists, duplicate role names (server error shown inline).
4. Bulk delete includes the signed-in user or the last admin: server error surfaces as a toast, selection resets.
5. Maintenance actions are destructive: each needs an explicit confirm with the exact scope, and a failed call must not look successful.
6. Profile: changing email/password for non-password-login (OIDC/API) users; mismatched passwords; avatar URL.

## Tasks

1. **Kit: dependencies and primitives.** Add `@tanstack/react-table`, `react-hook-form`, `zod`, `@hookform/resolvers`; generate shadcn `table`, `checkbox`, `select`, `input`, `label`, `form`, `badge`, `dialog`, `tabs`, `textarea`, `switch`, `popover`, `command`. Fix generated `cn` imports. Add `StatusBadge` (tones: neutral, success, warning, info, danger), `EmptyState`, `FormField`, `useConfirm`, `DataTable`, `useApiMutation`, `lib/format.ts` (`formatDate`, `formatDateTime`, relative time), `lib/labels.ts`. Tests (`bun test`): `format`, `data-table` selection helpers, permission-group helpers.
2. **Users list** `/users`: columns (user with avatar + type/status badges, email, user role, list role, created, last login), filter chips from search params, sortable columns, row actions (edit, delete), bulk delete, empty state, `users:manage` gating. Go route flip. e2e.
3. **User form** `/users/new`, `/users/$id`: type (user/api), username (pattern), name, email, status, password login + password fields, roles, one-time API token dialog, delete from the list only (as before). Go route flips. e2e.
4. **Roles**: `/users/roles`, `/users/roles/new`, `/users/roles/$id` (permission matrix grouped, "toggle all", high-risk warnings for `subscribers:sql_query` and `users:manage`, super admin read-only, clone, delete) and `/users/roles/lists`, `/new`, `/$id` (add list, per-list view/manage checkboxes). Go route flips. e2e.
5. **Profile** `/user/profile`, **Maintenance** `/settings/maintenance`. Go route flips. e2e.
6. **Cleanup and verification:** nav `ported: true`, delete old views/templates/JS, full checks, full Playwright suite, light/dark/mobile screenshots, restart the LAN app.
