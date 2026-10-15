# Checkpoint 0004 — Copy from Blender + add-on shell

- Date: 2026-10-15
- PID: docs/pid/01-copy-from-blender.md (capture + operator); docs/pid/08-addon.md (manifest, register, keymap, panel, save). Paste execute is a stub.
- Status: ready for review

## Done

A node selection in Blender becomes `nodevault.tree` JSON on the system clipboard. You can run this in the UI.

Install: Blender → Edit → Preferences → Extensions → Install from Disk → `v2/addon` (the folder with `blender_manifest.toml`). Enable NodeVault.

Then in a Shader, Geometry Nodes, or Compositor editor:

1. Select nodes.
2. Node editor header → NodeVault → Copy Nodes, or the NodeVault N-panel tab, or Ctrl/Cmd+Shift+C.
3. The system clipboard is canonical JSON. Native Ctrl/Cmd+C is unchanged.

Paste Nodes is registered and poll-enabled; execute reports "Paste is not in this build." Save writes `nodes.nodevault.json` via the file browser.

Capture (`addon/capture.py`) is callable without a window: selection rules (zone pair pointer, parent frames, whole group trees), stable `n1…` ids, property diffs vs a fresh node, `affects_sockets` from a vendored/repo catalog (else every enum/boolean), widgets (ramp, curve, image), links with both ends in the set, group `interface.items_tree`.

## Files

- `addon/blender_manifest.toml` — extension id `nodevault`, min 5.0.0, clipboard + files permissions, tests/ excluded from the zip.
- `addon/__init__.py` — `register` / `unregister` only; no bpy at import, so python3 interchange tests still run.
- `addon/capture.py` — selection → payload dict.
- `addon/copy_nodes.py` — Copy + Save operators. Copy calls `bpy.ops.node.clipboard_copy()` first, then writes `window_manager.clipboard`.
- `addon/paste_nodes.py` — poll only; execute cancelled.
- `addon/panel.py` — N-panel tab NodeVault, header submenu.
- `addon/tests/blender_capture_test.py` — 9 Blender-only acceptance tests.
- `catalog/versions/5.2.2_LTS/catalog.json` — extracted from the 5.2.2 binary (see 5.2 notes).

## Verified

- `python3 -m unittest discover -s addon/tests -t .`: 36 pass (does not collect the Blender script).
- Blender 5.1.0 and **5.2.2 LTS**: `addon/tests/blender_capture_test.py` 9/9: two linked shader nodes, dropped unselected link, frame `parent_id` with `location != location_absolute`, three-stop ramp, stable except `copied_at`, group second tree + interface, geometry two-node link, compositor two-node, register/unregister.
- `blender --command extension validate addon`: Success parsing TOML on 5.1 and 5.2.
- `bun test`: 47 pass. Catalog tests still pass with both 5.1.0 and 5.2.2_LTS catalogs.
- Not run in a GUI session: keymap feel on a real Mac Cmd vs Ctrl. Headless cannot press the shortcut. Install from Disk was not clicked in the app.

How to run the Blender tests:

```bash
# 5.1
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python addon/tests/blender_capture_test.py
# 5.2
/Applications/Blender_52.app/Contents/MacOS/Blender --background --factory-startup --python addon/tests/blender_capture_test.py
```

## Blender 5.2.2 vs 5.1.0

No change that breaks copy or the extractor.

Same: `location_absolute`, `is_editable`, `node_tree.interface.items_tree` (old `.inputs`/`.outputs` absent), `draw_color_simple()`, add-all menus + `node_operator`, `clipboard_copy` / `clipboard_paste`, `NODE_HT_header`, zone `paired_output` present but still **None** after `nodes.new` on an input (no auto-created pair), compositor MixRGB/Math/Gamma still undefined.

Catalog extract on 5.2.2: 521 nodes (118 shader / 359 geometry / 166 compositor) vs 492 on 5.1.0. 86 categories, 43 socket colors. Directory `catalog/versions/5.2.2_LTS/` because `version_string` is `5.2.2 LTS`.

`Material.use_nodes` still works and is deprecated for Blender 6.0 on both binaries. Tests still use it.

## Departures

- Paste is a stub. The keymap and panel expose it so the shell matches PID 08; execute is cancelled until PID 04.
- Catalogs are not copied into `addon/catalog/` yet. Capture loads `v2/catalog/versions` when running from this repo (5.1.0 and now 5.2.2_LTS). An Install-from-Disk add-on folder does not include that path, so a copied-out extension stores every enum/boolean (PID fallback) until build-time vendoring.
- Save uses `fileselect_add` rather than `ExportHelper` so we do not depend on `bpy_extras` import order.
- Cmd+Shift+C is a second keymap item (`oskey=True`) in addition to Ctrl+Shift+C.

## Next

Paste in the browser (`docs/pid/02-paste-in-browser.md`) and the graph visualizer (`docs/pid/07-graph-visualizer.md`) — PRD order 4 then 5. Those are the first on-screen graph. Paste in Blender stays after copy-from-browser.

## Open

- Tree key order (0001), ColorMapping hints (0002), nearest-patch tie-break (0003).
- Whether to vendor `catalog/versions/*` into `addon/catalog/` at zip build now, or wait for the add-on build script.
- `Material.use_nodes` removal in 6.0: not in range.
