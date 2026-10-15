# PID — Add-on

Primary. The Blender extension that runs Copy and Paste. The capture algorithm is the copy-from-Blender PID. The rebuild algorithm is the paste-in-Blender PID. This document is the shell around those operators: packaging, keymap, panel, and saving a file.

## Distribution

A Blender extension, the format in the Blender 5.2 manual. Legacy add-ons (`bl_info`, Install Legacy Add-on) are not the target. Extensions have been the way to ship an add-on since Blender 4.2.

`blender_manifest.toml` at the extension root:

```toml
schema_version = "1.0.0"
id = "nodevault"
version = "0.1.0"
name = "NodeVault"
tagline = "Copy nodes to the browser and paste them back"
maintainer = "Aman"
type = "add-on"
blender_version_min = "5.0.0"
license = ["SPDX:GPL-3.0-or-later"]

[permissions]
clipboard = "Copy and paste node trees as text"
files = "Save a node tree to a file"
```

Rules from the current manifest schema:

- `tagline` is one line, at most 64 characters, and does not end with punctuation.
- Each permission reason is one short line, at most 64 characters, and does not end with punctuation. Omit a permission rather than leaving it empty.
- `blender_version_min` is `5.0.0`. Any Blender 5.x is supported. The JSON clipboard path does not depend on the 5.2 copy-buffer behavior; that only affects how Blender's own Ctrl/Cmd+C works alongside NodeVault. Pre-5.0 editors are not claimed.
- There is no `bl_info`. Name, version, and Blender range live only in the manifest.
- Imports inside the extension are relative (`from . import serialize`). Preferences use `bl_idname = __package__` and are read with `context.preferences.addons[__package__].preferences`. `__package__` is not a string literal. A submodule reaches it with `from .. import __package__ as base_package`.
- Third-party Python libraries ship as wheels listed in the manifest. The core extension uses the standard library and `bpy` only, so it lists no wheels.
- User-writable files (the login token, once vault sync exists) go in `bpy.utils.extension_path_user(__package__, path="", create=True)`. The extension directory itself may be read-only, and an upgrade deletes files written inside it.

Build and check:

```bash
blender --command extension validate
blender --command extension build
```

Test by Install from Disk, not by dropping the folder into the old add-ons path.

The `network` permission is added in the sharing PID, when Sync to vault exists. The core manifest does not request it.

The extension ships the operators, the panel, and the vendored catalogs for the Blender versions in range. Catalogs are produced by the release command in the catalog PID and copied in at build time. They are not generated on the user's machine during install.

## Where the commands live

The same operators are available from:

- A NodeVault submenu in the node editor header.
- The N-panel, tab name NodeVault.
- The keymap below.

Copy's label is "Copy Nodes". Paste's label is "Paste Nodes".

## Keymap

Registered on the Node Editor keymap for every node tree type.

| Shortcut | Operator |
| --- | --- |
| Ctrl or Cmd, plus Shift, plus C | Copy |
| Ctrl or Cmd, plus Shift, plus V | Paste |

Blender's own Ctrl/Cmd+C and Ctrl/Cmd+V stay bound to Blender. Unregister removes the NodeVault keymap items.

## N-panel

The tab shows:

- The open tree type, or "No node tree".
- The selection count when a tree is open.
- Copy and Paste buttons.
- After a paste that skipped anything, the skip list from the paste PID. The list clears on the next copy and on the next paste.
- A Save button.

Save runs the copy procedure and writes the envelope to a path the user picks. The default file name is `nodes.nodevault.json`. The browser page accepts that file as a drop.

## Operators

| bl_idname | Role |
| --- | --- |
| `nodevault.copy_nodes` | Copy PID. |
| `nodevault.paste_nodes` | Paste PID. |
| `nodevault.save_nodes` | Copy procedure, then a file write via `ExportHelper`. |

`poll` matches the PID for that action. Reports use `self.report`. Success is info. A paste that created nothing, or a copy that stored warnings, is a warning. An unreadable clipboard or a tree-type mismatch is an error.

## Clipboard

NodeVault reads and writes `context.window_manager.clipboard` for the `nodevault 1` envelope. That needs the `clipboard` permission.

`bpy.ops.node.clipboard_copy()` is called first, as the copy PID describes, so Blender's on-disk copy buffer matches the selection. NodeVault does not read the system clipboard to discover what Ctrl/Cmd+C stored. Ctrl/Cmd+C does not store the node tree there.

## Layout

```text
addon/
  blender_manifest.toml
  __init__.py            register, unregister, keymap
  copy_nodes.py
  paste_nodes.py
  panel.py
  serialize.py           used by copy, no UI imports
  deserialize.py         used by paste, no UI imports
  catalog/               vendored catalog JSON
```

`serialize.py` and `deserialize.py` are callable from `blender --background --python` so tests do not need a window.

## Catalog footer

The panel shows the add-on version and `bpy.app.version_string`. When no vendored catalog matches that version, the footer reads: "No catalog for this Blender. Same-version paste still works. Browser colors will be missing until a catalog is extracted." Copy and paste stay enabled.

## Later, not in the core extension

The sharing PID adds login, Sync to vault, and Open. Those need the `network` permission and are absent until sharing is in scope. The core extension does not log in or upload.

## Acceptance

- Enable the extension. The submenu and N-panel appear in the node editor and are absent from the 3D View.
- The shortcuts copy and paste a two-node selection.
- Disabling the extension removes the keymap items and the classes.
- Save writes a file the browser page accepts when dropped.
- A shader tree, a geometry-node tree, and a two-node compositor tree each complete a copy.
