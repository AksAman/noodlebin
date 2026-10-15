# Checkpoint 0005 — Paste in the browser + graph visualizer

- Date: 2026-10-15
- PID: docs/pid/02-paste-in-browser.md; docs/pid/07-graph-visualizer.md; copy control from docs/pid/03-copy-from-browser.md
- Status: ready for review

## Done

Paste a NodeVault clipboard (or drop / open a `.nodevault.json`) at `/` and the graph draws. Nothing is uploaded.

Empty state: "Copy nodes in Blender with NodeVault, then paste here." plus an open-file control.

Filled: `packages/node-view` (React Flow, one `nv` renderer) with Y-flipped `location_absolute`, catalog header/socket colors (sRGB), wires, color ramp, frames, reroutes, groups (double-click + breadcrumb + Escape), zones as a bounding rectangle. Top bar: tree type, Blender version, node/group counts, catalog notice, Hide map, Copy, Clear.

Copy writes canonical JSON via `navigator.clipboard.writeText`. If that rejects, a readonly textarea appears: "Copy this text, then paste it in Blender."

```bash
cd v2
bun install
bun run --filter @nodevault/web dev
# open http://localhost:5173/ and paste a Blender copy (or open fixtures/handwritten/*.nodevault.json)
```

## Files

- `packages/node-view/` — layout, generic node, widgets, React Flow host.
- `apps/web/` — Vite paste page; catalogs imported at build time from `catalog/versions/*/catalog.json`.
- `packages/catalog/src/parseJson.ts` — parse without `node:fs` so the browser bundle does not pull Node APIs. `loadCatalogDirectory` stays on `@nodevault/catalog/load`.
- `fixtures/handwritten/three-stop-ramp.nodevault.json`, `frame-child.nodevault.json`, `group-inner.nodevault.json`.

## Verified

- `bun test`: 58 pass. `bun run typecheck`: all packages. `python3 -m unittest discover -s addon/tests -t .`: 36 pass.
- Browser at `http://localhost:5173/`: two-node fixture draws Noise Texture → Principled BSDF, Scale `5`, Fac→Roughness wire. Ordinary text shows "Clipboard is not a NodeVault node tree." and keeps the current graph (or stays empty). 5.1.0 Color Ramp fixture uses catalog header color and three ramp stops. Clear returns to empty. Copy fallback textarea appears when `writeText` is denied (document not focused in the automation browser).
- Not verified: Copied-for-2s label (clipboard permission), group double-click in the GUI, 200-node pan fps, paste of a live Blender 5.1/5.2 copy in this session.

## Departures

- Copy-from-browser (PID 03) is on this page because the filled top bar requires the Copy button. The clipboard write path is the PID procedure; the 2s "Copied" label was not seen under a denied clipboard.
- `warning_propagation` is omitted from property rows (every node has it; it buries the useful rows).
- No 200-node add-on fixture yet. The visualizer does not virtualize.
- NodeView takes extra `trees`, `blenderVersion`, and `showMinimap` props so groups, tooltips, and the map toggle work. `readOnly` is still required `true`.

## Next

Paste in Blender (`docs/pid/04-paste-in-blender.md`) — recreate the payload as live nodes. The add-on still stubs Paste.

## Open

- Whether to bump the handwritten two-node fixture from Blender 5.0.1 to 5.1.0 so it resolves a shipped catalog without a notice.
- Produce the 200-node geometry fixture from the add-on for pan/zoom acceptance.
- `Copied` confirmation under a focused, permissioned document.
