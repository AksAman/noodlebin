# Checkpoint 0007 — Copy all + paste and replace

- Date: 2026-10-15
- PID: extra operators on docs/pid/01-copy-from-blender.md and docs/pid/04-paste-in-blender.md (not specified there yet)
- Status: ready for review

## Done

**Copy All Nodes** copies every node in the open tree, including unselected ones. Selection is restored after Blender's native copy-buffer write. Poll requires a non-empty editable supported tree, not a selection.

**Paste and Replace Nodes** deletes every node in the open tree, then pastes the clipboard. Stored locations are kept (no cursor shift). A tree-type mismatch still creates nothing and does not clear the tree. Ordinary **Paste Nodes** still appends.

Header menu, N-panel, and keymaps:

- Ctrl/Cmd+Shift+C / V — copy selection / paste
- Ctrl/Cmd+Shift+Alt+C / V — copy all / paste and replace

## Files

- `addon/copy_nodes.py` — `nodevault.copy_all_nodes`
- `addon/paste_nodes.py` — `nodevault.paste_replace_nodes`
- `addon/capture.py` — `poll_copy(..., all_nodes=True)`
- `addon/rebuild.py` — `paste_payload(..., replace=True)`
- `addon/panel.py`, `addon/__init__.py` — menu, panel, keymap
- blender capture/paste tests

## Verified

- Blender 5.1.0 capture 10/10; paste 9/9 including copy-all payload, replace clears leftover RGB and keeps fixture locations, mismatch with `replace=True` leaves the geometry tree.
- Blender 5.2.2 LTS paste 9/9.

## Departures

- Copy-from-Blender PID still requires a selection for Copy Nodes. Copy All is extra.
- Paste-in-Blender PID says paste does not delete existing nodes. That remains true of Paste Nodes. Paste and Replace is extra and does delete the current tree's nodes (not group data-blocks elsewhere in the file).

## Next

Add-on packaging leftovers (`docs/pid/08-addon.md`, vendor catalogs into the extension zip). Sharing and embedding stay later.

## Open

- Whether these operators should be written into the PIDs after review.
- GUI: copy-all / replace in a live session (headless tests call capture/rebuild, not the operators).
