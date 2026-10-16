<a href="https://zerodha.tech"><img src="https://zerodha.tech/static/images/github-badge.svg" align="right" /></a>

[![listmonk-logo](https://user-images.githubusercontent.com/547147/231084896-835dba66-2dfe-497c-ba0f-787564c0819e.png)](https://listmonk.app)

listmonk is a standalone, self-hosted, newsletter and mailing list manager. It is fast, feature-rich, and packed into a single binary. It uses a PostgreSQL database as its data store.

[![listmonk-dashboard](https://github.com/user-attachments/assets/689b5fbb-dd25-4956-a36f-e3226a65f9c4)](https://listmonk.app)

Visit [listmonk.app](https://listmonk.app) for more info. Check out the [**live demo**](https://demo.listmonk.app).

## About this fork

This fork replaces listmonk's server-rendered admin (Go templates and Alpine) with a React single-page app in [`frontend/`](frontend): TanStack Start (SPA mode), shadcn/ui and Tailwind CSS v4. It is linted and formatted with oxlint and oxfmt and built with [bun](https://bun.sh). The backend, API and database schema are unchanged, and the app is still one binary.

- Every page under `/admin` is a route of the SPA. Go embeds the build and serves it after the usual permission check.
- The public pages (home, subscription form, preferences, opt-in, archive) and the admin login pages are still Go templates in `static/public/`.
- The upstream release binaries and the `listmonk/listmonk` Docker image contain the old admin, so build this fork from source.

## Build and run

Requirements: Go, bun and PostgreSQL.

```shell
cp config.toml.sample config.toml   # edit the database settings
make dist                           # builds the frontend and the Go binary into ./listmonk
./listmonk --install                # first run only: creates the DB schema (--upgrade for an existing DB)
./listmonk                          # http://localhost:9000/admin
```

### Docker

`docker-compose.yml` pulls the upstream image, which has the old admin. To run this fork, build the binary with `make dist` on Linux (the dev container works), build an image from the root `Dockerfile`, and set `image:` in the compose file to it.

### Local network

Set `address = "0.0.0.0:9000"` in `config.toml` so other devices can connect, then set **Settings → General → Root URL** to the address they use, for example `http://192.168.1.28:9000`. Links on the public pages and in emails are built from that URL.

## Developers

The Docker dev environment bundles Go, Postgres, bun and Playwright:

```shell
make build-dev-docker   # once
make run-dev-docker     # starts the services and opens a shell
make run                # inside the shell: builds the assets, installs a fresh DB, serves :9000
```

Frontend commands, run in `frontend/` (the same checks run in CI):

```shell
bun install
bun run dev          # Vite dev server, proxies /api to :9000
bun run lint         # oxlint
bun run fmt          # oxfmt
bun run typecheck
bun test
bun run build
```

`dev/seed/` fills a dev instance with fake data (`cd dev/seed && bun install && bun seed.ts`), and `tests/` holds the Playwright suite (it wipes the dev database). See the [developer setup](docs/docs/content/developer-setup.md) for the full workflow, including how to add a page.

The upstream [installation docs](https://listmonk.app/docs/installation) and [developer docs](https://listmonk.app/docs/developer-setup) describe the original project and may not match this fork.

## License
listmonk is licensed under the AGPL v3 license.
