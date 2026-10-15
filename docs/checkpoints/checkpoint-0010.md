# Checkpoint 0010 — Next.js web app

- Date: 2026-10-15
- PID: docs/pid/09-sharing.md (web host; no upload/API yet)
- Status: ready for review

## Done

`apps/web` is a Next.js 15 App Router app. Routes are the same: `/`, `/paste`, `/p/:slug`. `/@author` is rewritten to `/author/:slug` because a Next `@` folder is a parallel route. Imports in the web app use `@/` (app files plus `@/catalog`, `@/interchange`, `@/node-view`, `@/fixtures`, `@/catalog-data`).

```bash
cd v2
bun run --filter @nodevault/web dev
# http://localhost:5173/
# http://localhost:5173/paste
# http://localhost:5173/p/three-stop-ramp
# http://localhost:5173/@nodevault
```

## Files

- `apps/web/app/` — layout, gallery, paste, post, author, not-found.
- `apps/web/components/`, `apps/web/lib/` — UI and ingest/posts/catalogs.
- `apps/web/middleware.ts` — `/@slug` rewrite.
- `apps/web/next.config.ts`, `tsconfig.json` — `@/` aliases.
- Removed Vite, React Router, `apps/web/src/`.
- CI GitHub-hosted job runs `bun run --filter @nodevault/web build`.

## Verified

- `bun test apps/web`: 6 pass. `bun run --filter @nodevault/web typecheck` and `build`: pass.
- Browser: gallery, paste empty state, `/p/three-stop-ramp`, `/@nodevault`.

## Departures

- Still no `POST /api/posts`. Catalogs are still compiled in.
- Workspace packages keep `@nodevault/*` internally; only the web app uses `@/`.

## Next

Sharing API + upload (or add-on paste-from-link). Embedding after sharing’s public loop is real.

## Open

- PID updates for Copy All / Paste and Replace.
- Two-node fixture still 5.0.1.
- 200-node geometry fixture.
