# Migrating from upstream listmonk to this fork

This fork keeps listmonk's backend, API, configuration and database schema. Only the admin UI is new. Moving an existing install means swapping the binary or image and running the database upgrade. Your subscribers, lists, campaigns, templates and settings stay where they are.

Tested path: an upstream `v5.0.0` install on Docker Compose (Dokploy) moved to this fork's `v7.0.0` build, with its data and settings intact. Other starting versions use the same mechanism, but I have not run them.

## Before you start

**1. Check the database version.** This fork's last migration is `v7.0.0`.

```shell
psql -U listmonk -d listmonk -c "SELECT value->>-1 AS last_migration FROM settings WHERE key = 'migrations';"
```

With Docker Compose: `docker compose exec db psql -U listmonk -d listmonk -c "..."`.

- `v7.0.0` or lower: you can migrate. Every migration above your current one runs on `--upgrade`.
- Higher than `v7.0.0`: you are on an upstream release newer than this fork. Don't migrate. The fork can't read a schema it doesn't know, and there is no downgrade.

**2. Back up.** Upgrades can't be undone, so take a dump you have checked.

```shell
# Docker Compose
docker compose exec -T db pg_dump -U listmonk -Fc listmonk > listmonk-before-fork.dump

# Postgres on the host
pg_dump -U listmonk -Fc listmonk > listmonk-before-fork.dump

# Check that the file is a readable dump
pg_restore -l listmonk-before-fork.dump | head
```

Also keep a copy of your `uploads` directory and `config.toml`.

**3. Pick a tag.** Use a pinned tag such as `mohamad416/listmonk-shadcn:v7.0.3-shadcn`, not `latest`, so a redeploy can't change versions by itself.

## Docker Compose

1. In your compose file, change only the app image:

   ```diff
   - image: listmonk/listmonk:v5.0.0
   + image: mohamad416/listmonk-shadcn:v7.0.3-shadcn
   ```

2. Keep the database service, the volumes and the environment variables as they are.
3. Keep the start command that runs `--upgrade`. The upstream compose file has it:

   ```yaml
   command: [sh, -c, "./listmonk --install --idempotent --yes --config '' && ./listmonk --upgrade --yes --config '' && ./listmonk --config ''"]
   ```

   If your command starts only `./listmonk`, the app stops with `there are N pending database upgrade(s)`. Run the upgrade once, then start normally:

   ```shell
   docker compose run --rm app ./listmonk --upgrade --yes
   docker compose up -d
   ```

4. Apply it: `docker compose pull && docker compose up -d`.

On **Dokploy** or **Coolify**, edit the compose file in the dashboard, change the image line and redeploy. See the [README](README.md#docker) for full compose files.

## Binary install (systemd)

1. Get the binary, either by building it (`make dist`) or by copying it out of the image. It is a static Linux binary with the admin assets embedded, so nothing else is needed:

   ```shell
   docker create --name lm mohamad416/listmonk-shadcn:v7.0.3-shadcn
   docker cp lm:/listmonk/listmonk ./listmonk-shadcn
   docker rm lm
   ```

   Pick the right architecture with `--platform linux/amd64` or `linux/arm64` on `docker create`.

2. Stop the service, keep the old binary, install the new one and upgrade:

   ```shell
   sudo systemctl stop listmonk
   sudo mv /opt/listmonk/listmonk /opt/listmonk/listmonk.upstream
   sudo install -m 755 listmonk-shadcn /opt/listmonk/listmonk
   cd /opt/listmonk && ./listmonk --config config.toml --upgrade
   sudo systemctl start listmonk
   ```

## After the upgrade

- `curl https://your-host/health` returns `{"data":true}`.
- **Settings** shows the version in its title, for example `v7.0.3-shadcn`.
- Sign in. Users, roles and API tokens are unchanged, so existing scripts keep working.
- Open a campaign, a template and a list, then send a test message from a campaign.
- Open your public subscription page and an unsubscribe link from a recent email.

## What changes for you

| | Upstream | This fork |
| --- | --- | --- |
| Admin UI | A Vue app (v5, v6) or server-rendered pages with Alpine (v7) | A React single-page app (TanStack Start, shadcn/ui) |
| API, CLI, env vars, `config.toml` | | Same |
| Database schema | | Same, up to migration `v7.0.0` |
| Public pages (subscribe, unsubscribe, opt-in, archive) | Go templates | Same Go templates and routes. The stylesheet may differ. |
| `/` | Public home page | Redirects to `/admin` |
| Custom CSS/JS for the **public** pages | Applied | Applied |
| Custom CSS/JS for the **admin** | Applied | Saved but not loaded. It targeted the old admin's markup. |
| Admin templates in a `--static-dir` | Used | Ignored, because the admin is now a built app |

Public template overrides in a `--static-dir` still work. I haven't tested them against this fork.

## Rolling back

- **No migration ran** (your DB was already at `v7.0.0`): set the old image or binary back and restart.
- **A migration ran**: the old version can't use the migrated schema. Restore the dump you took:

  ```shell
  docker compose stop app
  docker compose exec -T db pg_restore -U listmonk -d listmonk --clean --if-exists < listmonk-before-fork.dump
  # set the image back to the upstream tag, then:
  docker compose up -d
  ```

Restoring removes everything written since the dump: new subscribers, opens, clicks and campaign progress.

## Troubleshooting

- **`there are N pending database upgrade(s)`**: run `./listmonk --upgrade` (see step 3 under Docker Compose).
- **The old admin still shows**: the container is running a cached upstream image. Run `docker compose pull`, then recreate the container.
- **`exec format error`**: the image doesn't match your CPU. The `v7.0.3-shadcn` and `latest` tags are multi-arch. Older version-and-commit tags are `amd64` only.
- **Links in emails point to the wrong host**: set **Settings → General → Root URL** to your public address.
