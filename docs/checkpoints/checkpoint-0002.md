# Checkpoint 0002 — Node catalog extractor

- Date: 2026-10-15
- PID: docs/pid/06-node-catalog.md (extractor slice)
- Status: ready for review

## Done

A headless command reads one Blender binary and writes that version's drawing registry. No application code change is required for a node the generic view can draw.

From `v2/`:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/extract_node_catalog.py -- --out catalog/versions
```

On this machine that wrote `catalog/versions/5.1.0/catalog.json` (Blender 5.1.0, `theme_source` `factory`).

What the catalog contains, for this binary:

- 492 nodes. 112 accept a shader tree, 332 a geometry-node tree, 120 a compositor tree (a node can accept more than one).
- 81 add-menu categories, discovered from this version's `NODE_MT_add` → add-all menus → `node_operator` / `draw_menu` source. No `NODE_MT_category_SH_NEW` hardcoded.
- 28 theme color fields from `themes[0].node_editor`, including `shader_node`, `geometry_node`, `frame_node`, zone colors.
- 35 socket colors from `draw_color_simple()` (works without a window). None unresolved.
- Socket-layout probe: `GeometryNodeSwitch.input_type` and `ShaderNodeMath.operation` are `affects_sockets` true (94 properties flagged in total). The fingerprint is `(identifier, bl_idname, enabled)` because Switch keeps socket names and changes type, and Math keeps names and flips `enabled`.
- Widgets: `color_ramp` (ValToRGB), `curve_mapping`, `image`, `frame`, `reroute`, `group`, `zone` (`pair_property` `paired_output` on zone inputs). `nodes.new` on a zone input does **not** create the output in 5.1.0, so `auto_creates_pair` is omitted; paste will create both ends.
- `new_widget_hints` on stdout lists `ColorMapping` / `TexMapping` (and similar) so a later widget kind is visible. They still get `generic` entries.
- 4 skipped rows: `*CustomGroup` types and `CompositorNodeGamma`, all `nodes.new` failures.

`packages/catalog` (the loader) is not in this slice.

Commands:

- Extract: the blender line above.
- `python3 -m unittest discover -s scripts/tests -t . -v` (schema helpers + acceptance against the written catalog).
- `bun run test:py` now runs add-on tests and catalog tests.

## Files

- `scripts/catalog_schema.py` — pure helpers: menu-source regex, color_tag → theme key, widget id, canonical catalog JSON. No bpy.
- `scripts/extract_node_catalog.py` — Blender-only extractor. Themes, menus, node records, socket-layout probe, zone detection, cleanup. Does not save a `.blend`.
- `scripts/__init__.py`, `scripts/tests/__init__.py`, `scripts/tests/test_catalog_schema.py` — 12 tests. Acceptance is skipped until a catalog file exists; it passes against 5.1.0.
- `catalog/versions/5.1.0/catalog.json` — extracted registry (~1.5 MB). Commit this directory when shipping a version.
- `package.json` — `test:py` also discovers `scripts/tests`.

## Verified

- Extract on Blender 5.1.0 (factory startup, bundled Python 3.13.9): exit 0, catalog as above. `ShaderNodeBsdfPrincipled` has `header_color` `shader_node` and 31 inputs.
- Second extract of the same binary to a temp dir: 1,573,349 bytes each; identical after removing `extracted_at`.
- `python3 -m unittest discover -s scripts/tests -t .`: 12 pass.
- `python3 -m unittest discover -s addon/tests -t .`: 36 pass (unchanged).
- `bun test`: 34 pass. `bun run typecheck` not re-run; no TypeScript changed.
- Not run: the catalog loader, the graph visualizer, or any UI. Those are later slices. The PID's last acceptance line (a fictional `bl_idname` drawing without a new renderer) belongs to the visualizer.

## Departures

- Menu discovery reads this binary's Python `draw` methods (`node_operator`, `draw_menu`, including `path=`). `bpy.ops.node.add_node` type enums are empty in background mode, and `nodeitems_utils` has no registered categories on 5.1. That is the PID's "draw as a hint / collect operator types" path, not a hardcoded previous-release menu id.
- Socket-layout probe compares `(identifier, bl_idname, enabled)`, not identifiers alone. Identifiers-only misses Switch and Math on this version.
- Header color uses `color_tag` (what 5.1's draw code uses) mapped to the theme field, then RNA base class, then `layout_node`. `NodeFrame` prefers `frame_node` when present. 5.1 has no `compositor_node` theme field; compositor nodes use their `color_tag`.
- Zone `auto_creates_pair` is only written when `nodes.new` actually created the other end. On 5.1.0 it does not. Pair identity still comes from `paired_output` and from this binary's `NodeMenu.*_zone` source assignments, so both ends get `widget` `zone`.
- Abstract RNA types (`ShaderNode`, …) are not attempted. Failed `*CustomGroup` types remain in `skipped`.
- Catalog JSON uses stdlib `json.dumps(indent=2)`, not the interchange `JSON.stringify` emitter. A second extract of the same binary is still byte-identical except `extracted_at`.
- `new_widget_hints` is stdout only; it is not a catalog field.

## Next

Node catalog loader (`packages/catalog`): types, load `catalog/versions`, fallback to same major.minor nearest patch, and the "no catalog" path the visualizer will use. PID 06, the rest of that document after "The release command" / "How the visualizer joins".

## Open

- Tree key order from checkpoint 0001 is still unanswered; interchange keeps the worked example's order.
- `new_widget_hints` currently names `ColorMapping` and `TexMapping` on texture nodes. Those are not catalog widget ids. Confirm they stay hints-only until a visualizer slice wants them.
- Four `*CustomGroup` / `CompositorNodeGamma` skips are expected on 5.1.0. No action unless a later version defines them.
