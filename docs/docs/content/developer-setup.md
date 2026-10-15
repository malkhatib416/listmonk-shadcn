# Developer setup
The app is a Go backend that server-renders the admin UI (HTML templates with JS, built with [bun](https://bun.sh)). 


### Pre-requisites
- `go`
- `bun` (if you are working on the admin frontend)
- Postgres database. If there is no local installation, the demo docker DB can be used for development (`docker compose up demo-db`)


### First time setup
`git clone https://github.com/knadh/listmonk.git`. The project uses go.mod, so it's best to clone it outside the Go src path.

1. Copy `config.toml.sample` as `config.toml` and add your config.
2. Build the frontend and the binary: `make dist` (builds the SSR admin and the Go binary, embedding the assets). Once the binary is built, run `./listmonk --install` to run the DB setup. For subsequent dev runs, use `make run`.

> [mailhog](https://github.com/mailhog/MailHog) is an excellent standalone mock SMTP server (with a UI) for testing and dev.


### Running the Docker dev environment

- Run `make build-dev-docker` once to build the dev container which bundles Go, Postgres, Bun etc.
- Run `make run-dev-docker` to start it and enter its shell.
- Inside the shell, run `make run` which builds static assets, initializes a fresh DB, and starts listmonk on `:9000`.
- For subsequent changes, simply Ctrl-C and re-run `make run` for changes to Go and static files to be picked up.


Run `make stop-dev-docker` to stop the container and `make rm-dev-docker` to completely remove it.

### New admin frontend (`frontend/`)

A TanStack Start SPA with shadcn and Tailwind v4, being ported page by page. Ported pages are served by Go from `frontend/dist/client`; the rest of `/admin` is still the Go-template admin.

Inside the dev container, in `frontend/`:

```sh
bun install
bun run dev          # Vite dev server on http://localhost:5173/admin/settings/logs (proxies /api etc. to :9000)
bun run lint         # oxlint
bun run fmt          # oxfmt (fmt:check in CI)
bun run typecheck
bun test
```

`make build-frontend-app` produces the production build, which `make dist` embeds into the binary.

Log in at http://localhost:9000/admin first. The session cookie is shared with the Vite dev server on `localhost`.

The app bootstraps from `GET /api/config`, `/api/profile` and `/api/lang/:lang`, then renders the sidebar layout (`src/routes/_app.tsx`). Sidebar entries live in `src/lib/nav.ts`; unported entries are plain links to the old Go pages.

#### Porting a page

1. Add the route under `src/routes/_app/` (for example `settings/logs.tsx`) and build it from `src/components/ui` and `PageHeader`. Fetch with `apiFetch`, translate with `useT()`, gate actions with `useCan()`.
2. In `cmd/handlers.go`, point the page's route at `a.ServeAdminApp`, keeping its `pm(...)` permission check.
3. Set `ported: true` on the item in `src/lib/nav.ts`.
4. Delete the old Go view, template and JS.
5. Add or update the Playwright spec in `tests/specs/`.
6. Check the page in light and dark, and at 375px wide.

When adding shadcn components with `bunx shadcn@latest add`, the generated files import `cn` from the `cn` npm package and the sonner component imports `next-themes`. Point them at `@/lib/utils` and `@/components/theme-provider`, and remove both packages.

### Fake data

`dev/seed/` fills a freshly installed dev instance with fake lists, subscribers, templates, campaigns (with views, clicks and bounces), users and roles, using [faker](https://fakerjs.dev):

```sh
cd dev/seed && bun install
LISTMONK_URL=http://localhost:9000 bun seed.ts   # SEED=7 for reproducible data, SUBSCRIBERS=1000 for more
```

Stats and bounces are inserted with SQL through `docker exec dev-db-1 psql`; set `SEED_PSQL` to a different command if your database container has another name.

### Frontend tests

listmonk maintains a Playwright suite in `tests/` for end-to-end testing the admin UI. It runs in the Docker dev environment that bundles all the necessary dependencies (Postgres, Mailhog, Bug etc.).

#### Running

Follow the steps described above to run and enter the Docker dev environment.

Inside the dev container shell at `/app`:

```sh
make dist

cd tests
bun install
bun playwright install --with-deps chromium
bun run test
```

# Production build
Run `make dist` to build the SSR admin frontend and the Go binary, embedding the static assets into a single self-contained binary, `listmonk`.
