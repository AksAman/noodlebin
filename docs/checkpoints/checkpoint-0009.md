# Checkpoint 0009 — Sharing pages (static posts)

- Date: 2026-10-15
- PID: docs/pid/09-sharing.md (first slice: public pages, not upload/API/add-on sync)
- Status: ready for review

## Done

Paste moves to `/paste`. `/` is a gallery of covers (newest is just the static list). `/p/:slug` draws that post’s graph with the same Copy control as paste. `/@author_slug` is the same grid for one author.

Four handwritten fixtures are the first posts (`noise-roughness`, `three-stop-ramp`, `frame-child`, `group-inner`). Tree-type filters are on the home grid.

```bash
cd v2
bun run --filter @nodevault/web dev
# http://localhost:5173/           gallery
# http://localhost:5173/paste     local clipboard paste
# http://localhost:5173/p/three-stop-ramp
```

## Files

- `apps/web/src/App.tsx` — React Router.
- `apps/web/src/HomePage.tsx`, `PostPage.tsx`, `AuthorPage.tsx`, `SiteNav.tsx`, `posts.ts`.
- `apps/web/test/posts.test.ts`.

## Verified

- `bun test`: 60 pass. `bun run typecheck`: all packages.
- Browser: `/` lists four shader posts; `/p/three-stop-ramp` shows Color Ramp + Copy; `/paste` still has the empty paste copy; `/@nodevault` lists the same four.

## Departures

- No server, no `POST /api/posts`, no edit tokens, no video, no `.blend`, no 1200×630 card. Covers are CSS gradients, not `cover_url` images.
- No add-on login, Sync to vault, Open, or `paste_link`.
- Posts are compiled in from fixtures, not a database.

## Next

Sharing API + upload (or add-on paste-from-link). Embedding (`docs/pid/10-embedding.md`) after sharing’s public loop is real.

## Open

- PID updates for Copy All / Paste and Replace.
- Two-node fixture still 5.0.1.
- 200-node geometry fixture.
