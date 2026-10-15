# Checkpoint 0003 — Node catalog loader

- Date: 2026-10-15
- PID: docs/pid/06-node-catalog.md (loader slice)
- Status: ready for review

## Done

The browser can pick a catalog for a payload's Blender version and join it to a node without drawing anything yet.

TypeScript, `packages/catalog` (`@nodevault/catalog`):

- `loadCatalogDirectory(path)` reads every `catalog/versions/<dir>/catalog.json`. A missing directory is an empty index.
- `resolveCatalog(index, blender_version)`:
  - exact `[major, minor, patch]` match
  - else same major.minor, nearest patch (tie: the higher patch)
  - else `catalog: null` and a notice that this Blender version has not been extracted
- `headerColor` / `socketColor` / `lookupNode` / `widgetId` implement the join rules the visualizer will call: theme key → `[0.25, 0.25, 0.25]`; no catalog or no entry → header `[0.2, 0.2, 0.2]`; unknown socket → `[0.63, 0.63, 0.63]`. Frame, reroute, and group widgets are taken from the payload even with `catalog` null.
- A catalog that only adds `FictionalNewNode` with two float sockets and `widget` `generic` is enough to look that node up. No renderer file exists yet; the visualizer PID will draw it through the generic view.

From `v2/`:

```bash
bun test
bun run typecheck
```

There is no UI. To poke the shipped 5.1.0 catalog:

```bash
cd v2 && bun repl
```

```ts
const { loadCatalogDirectory, resolveCatalog, headerColor, lookupNode } = await import("./packages/catalog/src/index.ts")
const index = await loadCatalogDirectory("catalog/versions")
const r = resolveCatalog(index, [5, 1, 0])
lookupNode(r.catalog, "ShaderNodeBsdfPrincipled")?.header_color  // "shader_node"
headerColor(r.catalog, "ShaderNodeBsdfPrincipled")               // factory green
resolveCatalog(index, [4, 2, 0]).notice                          // not extracted
```

## Files

- `packages/catalog/package.json`, `tsconfig.json` — workspace package; depends on `@nodevault/interchange` for socket/node types.
- `packages/catalog/src/types.ts` — catalog record types and fallback color constants.
- `packages/catalog/src/resolve.ts` — index and version selection.
- `packages/catalog/src/join.ts` — header/socket/widget lookup.
- `packages/catalog/src/load.ts` — directory load and JSON parse.
- `packages/catalog/src/index.ts` — public surface.
- `packages/catalog/test/catalog.test.ts` — 13 tests, including a load of `catalog/versions/5.1.0`.
- `docs/checkpoints/checkpoint-0003.md` — this file.

## Verified

- `bun test`: 47 pass (13 catalog + 34 interchange).
- `bun run typecheck`: clean.
- Shipped 5.1.0 catalog: exact match, Principled has `shader_node` and more than one input, all three tree types present.
- Not run: no page, no React Flow, no Blender paste. The add-on still has no Python catalog loader; same-version paste does not need one. Cross-version paste (PID 04 / 06 add-on use) will vendor catalogs and resolve in Python later.

## Departures

- Nearest-patch ties (request 5.1.1 when 5.1.0 and 5.1.2 exist) pick the **higher** patch. The PID says "nearest" and does not break ties.
- Version selection uses the `blender_version` triple inside the JSON, not the directory name. Directory names stay the extractor's `version_string` with spaces as `_`; a mismatched folder name still loads if the JSON is valid.
- Join helpers live in this package so the visualizer does not hardcode `[0.25,…]`. Drawing is still the next PID.
- No Python resolver in this slice. The PID's add-on cross-version rules run at paste time.

## Next

Copy from Blender (`docs/pid/01-copy-from-blender.md`), with the add-on shell (`docs/pid/08-addon.md`) as far as needed for the operator to run: selection → `nodevault.tree` on `window_manager.clipboard`. That is PRD order 3, then 8 as the wiring around it. Paste in the browser and the graph visualizer stay after that.

## Open

- Tree key order from checkpoint 0001, still unanswered.
- `ColorMapping` / `TexMapping` hints from checkpoint 0002, still unanswered.
- Confirm the nearest-patch tie-break (higher vs lower) if you care before two patch catalogs exist.
