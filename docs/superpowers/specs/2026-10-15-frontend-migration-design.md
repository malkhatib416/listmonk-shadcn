# Admin frontend migration: TanStack Start + shadcn + Tailwind v4

Date: 2026-10-15

## Why

The current admin (Go-rendered HTML + Alpine.js + Oat CSS, in `static/admin/`) is visually poor and hard to use. The migration is a redesign as much as a rewrite. A polished, first-class **dark theme** is a hard requirement.

## Goals

- Replace the 26 Go-SSR admin views with a React app on TanStack Start (SPA mode) in `frontend/`.
- UI built on shadcn/ui (Radix) and Tailwind CSS v4.
- Dark theme: light / dark / system, persisted, applied before first paint (no flash), every component and page verified in both themes.
- Tooling: bun for install/scripts, oxlint for linting, oxfmt for formatting. No eslint, no prettier.
- Single Go binary preserved. No Bun/Node process at runtime.
- Each ported page is shippable on its own; old and new admin coexist until the last page is ported.

## Non-goals

- Changing public pages (subscription forms, archive, unsubscribe, opt-in) or the login/OIDC/password-reset pages. They stay Go-rendered.
- Changing the REST API contract. New JSON endpoints are added only where a view has none.
- Replacing CodeMirror, Squire, the email builder or chart.js.

## Success criteria

- All routes under `/admin` served by the new app; `static/admin/` removed.
- Playwright specs in `tests/` pass against the new UI.
- Dark and light themes both reviewed on every page; no unstyled or low-contrast element in either.
- `bun run lint`, `bun run fmt:check`, `bun run build` clean in CI.
- `make build` and the Docker image produce a working binary with the embedded frontend.

## Architecture

### Runtime and hand-off

TanStack Start runs in SPA mode: the build emits a static shell (`index.html`) plus hashed JS/CSS assets. Go embeds them with stuffbin and serves assets at `/admin/static/*`.

For each `/admin/*` path, the route table in `cmd/handlers.go` picks one of:

- ported: serve the SPA shell (after the existing auth middleware, so unauthenticated users still redirect to login with `next`),
- unported: keep the current Go template handler.

A single catch-all replaces the per-page Go routes once everything is ported. Permission checks (`pm(...)`) stay on the API endpoints; the SPA additionally hides routes and actions the user cannot use.

### Bootstrap data

Go templates currently inject `window._LM_CONFIG`, `window._LM_I18N`, the user and permissions. The SPA gets the same through one `GET /api/bootstrap` call (config, user, permissions, i18n strings for the user's language, asset/custom-CSS versions). It is loaded in the root route's `beforeLoad` and cached by TanStack Query.

`/admin/custom.css` and `/admin/custom.js` (user-provided appearance settings) keep being served by Go and linked from the shell.

### Data layer

Pages fetch from the existing `/api/*` endpoints (97 today) through a small typed client plus TanStack Query. Before porting a page, audit what its Go handler injects server-side (dashboard, analytics and settings are the likely gaps) and add a JSON endpoint if missing. Errors go through one shared handler that surfaces toasts and redirects to login on 401.

### Frontend structure (`frontend/`)

- `src/routes/`: file-based TanStack Router routes mirroring `/admin` paths.
- `src/components/ui/`: shadcn components. `src/components/`: app components (data table, list picker, confirm dialog, etc.).
- `src/lib/`: API client, bootstrap, i18n `t()` helper over the Go language JSON, permissions helper.
- `src/widgets/`: React wrappers around CodeMirror, Squire rich text, email-builder bundle, chart.js.
- Tailwind v4 CSS-first config in `src/styles.css`; design tokens as CSS variables with `:root` and `.dark` sets. Geist (already shipped) stays as the font.

### Theming

Class-based dark mode (`.dark` on `<html>`). A tiny inline script in the shell reads `localStorage.theme` (`light`/`dark`, absent = system) and sets the class before render. A theme toggle lives in the sidebar footer. Charts and CodeMirror read the same tokens so they follow the theme.

### Build wiring

- `frontend/` scripts: `dev`, `build`, `lint` (oxlint), `fmt` / `fmt:check` (oxfmt), `typecheck`.
- Makefile: build `frontend/dist`, stuffbin maps it to `/admin/static`. Replaces the `static/admin/build.mjs` flow when migration completes.
- Dockerfile and `dev/` compose updated to use bun for the frontend build and a Vite dev server proxying `/api` to Go.
- Lint/format config checked in (`.oxlintrc.json`, oxfmt config).

## Rollout order

1. Scaffold `frontend/`: Start (SPA), Tailwind v4, shadcn, oxlint/oxfmt, theme tokens, dark mode, build + Makefile/Docker wiring. Shell served for one placeholder route.
2. Bootstrap endpoint, API client, i18n, permissions, app layout (sidebar, header, theme toggle), shared data table and dialogs.
3. Simple pages: logs, maintenance, message, profile, users, user roles, list roles.
4. Lists (overview, detail, forms, analytics), templates, media, bounces, import.
5. Subscribers (table, filters, detail/activity).
6. Campaigns (list, editor with rich text/code/visual builders, analytics), dashboard.
7. Settings (all tabs).
8. Cleanup: remove `static/admin/`, Go template handlers, Alpine/Oat, unused i18n key list; collapse routes to a catch-all.

Each step ends with: page works in light and dark, its Playwright spec updated and green, lint/format clean, commit.

## Testing

- Playwright specs in `tests/` updated per ported page (selectors move from Oat/Alpine markup to roles and labels).
- Theme: a Playwright check per page group that loads with `colorScheme` dark and light and asserts no console errors; visual review in both themes.
- Go: tests for `/api/bootstrap` and for the ported/unported routing.

## Risks

- Server-injected data with no JSON equivalent: found by the per-page audit, adds backend work to some steps.
- Editor widgets (Squire, email builder, CodeMirror) in React: lifecycle and theming bugs. Isolated in `src/widgets/` and ported late.
- SPA mode drops SSR: first paint depends on JS + bootstrap call. Acceptable for an authenticated admin.
- Two admins coexist for a while: visual inconsistency between old and new pages mid-migration.
