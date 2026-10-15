# Checkpoint 0006 — Paste in Blender

- Date: 2026-10-15
- PID: docs/pid/04-paste-in-blender.md
- Status: ready for review

## Done

A `nodevault.tree` clipboard becomes live nodes in the open editor. Paste is no longer a stub.

Poll: node editor, supported tree type, editable tree. Clipboard is read at execute, not poll.

Mismatch reports both types, for example "Copied from a shader tree. This editor is geometry nodes.", and creates nothing. Ordinary text reports "Clipboard is not a NodeVault node tree."

Rebuild (`addon/rebuild.py`): groups first (`node_groups.new`, never edit an existing group), interface via `interface.new_socket` / `new_panel`, zone inputs before outputs (adopt an auto-created pair when `nodes.new` already spawned it), then remaining nodes, `affects_sockets` properties first, widgets (ramp / curve / image), socket defaults, parent + location with `cursor_location - origin.selection_center` on unparented root nodes, flags, links, names, selection. Expected skips do not abort. The N-panel lists each skip. Copy and a successful paste clear the previous skip list.

Ctrl/Cmd+Shift+V is already mapped. Native Ctrl/Cmd+V is unchanged and is not called for a NodeVault clipboard.

```bash
cd v2
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python addon/tests/blender_paste_test.py
/Applications/Blender_52.app/Contents/MacOS/Blender --background --factory-startup --python addon/tests/blender_paste_test.py
```

## Files

- `addon/rebuild.py` — payload → live nodes.
- `addon/paste_nodes.py` — operator execute, UNDO, reports.
- `addon/panel.py` — last-paste skip list.
- `addon/copy_nodes.py` — clears skips on copy.
- `addon/tests/blender_paste_test.py` — 7 headless acceptance tests.

## Verified

- `python3 -m unittest discover -s addon/tests -t .`: 36 pass.
- `bun test`: 59 pass.
- Blender 5.1.0 and 5.2.2 LTS: `blender_paste_test.py` 7/7 — shader links + three-stop ramp, handwritten ramp fixture lands on the cursor, shader payload into a geometry tree creates no nodes and names both types, existing group name `Inner` is left untouched and a second group is created, unknown `bl_idname` pastes the other node and lists the skip, frame parent round-trip, operator registered with `UNDO`.
- Capture tests still 9/9 on 5.1. `blender --command extension validate addon`: Success parsing TOML.

## Departures

- Headless tests call `paste_payload` rather than the operator, because there is no `space_data`.
- One Ctrl/Cmd+Z removing the whole paste was not pressed in a GUI session. `bl_options` includes `UNDO`.
- Native Ctrl/Cmd+V was not re-checked in a GUI session (the paste operator does not call `node.clipboard_paste`).

## Next

Add-on packaging leftovers from `docs/pid/08-addon.md` (vendor catalogs into the extension zip). Sharing and embedding stay later.

## Open

- Whether to vendor `catalog/versions/*` into `addon/catalog/` at zip build.
- Whether to bump the handwritten two-node fixture from 5.0.1 to 5.1.0.
- 200-node geometry fixture for the visualizer.
- GUI: undo after paste, Cmd/Ctrl+Shift+V feel, skip list in the N-panel after an unknown type.
