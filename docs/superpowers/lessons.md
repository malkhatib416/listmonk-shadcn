# Lessons

Patterns from the admin frontend migration. Read at the start of a session.

- **Look at it before calling a page done.** The first foundation passed every test and still "didn't look modern". Check light, dark and 375px screenshots, not just green specs.
- **Dev container volumes.** `frontend/dist` is a Docker volume. A host build never reaches the container: build inside it, rebuild the Go binary, restart listmonk (it loads the build at startup). A route that is "Not found" in the SPA while the bundle on the host has it is this.
- **Playwright kills listmonk.** Its `webServer` runs `pkill -9 listmonk` and reinstalls the DB. Stop a manual instance first (`kill -9 <pid>`; `pkill -f playwright` kills the shell running it).
- **Portals mount late.** Radix dialog content renders after the first commit, so a ref effect keyed on state can miss the node. Use a callback ref (see `PreviewDialog`).
- **Iframes take the keyboard.** After a preview iframe loads, Escape does not reach the dialog; close with the button in specs.
- **Never format vendored bundles.** `frontend/public/**` is ignored by oxlint and oxfmt; `email-builder.umd.js` was reformatted once by mistake.
- **shadcn CLI regressions.** It re-adds the `cn` and `next-themes` packages and imports; repoint to `@/lib/utils` and `bun remove` them each time.
- **Silent no-op edits.** Multi-line Python replaces must `assert old in s`; formatters change whitespace under you.
- **zsh.** Never assign `path=`; use `sed -i ''` on macOS; quote globs passed to `git grep`/`grep --include`.
- **Test first, really.** Several helpers were written together with their tests (roles, maintenance, paging, richtext, settings `smtpTestPayload`). Write the test, watch it fail, then implement.
