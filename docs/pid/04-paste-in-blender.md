# PID — Paste in Blender

Primary. A `nodebin 1` clipboard becomes nodes in the open node editor. The payload shape is the interchange PID. Cross-version catalog rules are the catalog PID. The keymap is the add-on PID.

## Who can run it

The operator polls true when the area is a node editor with an editable tree of a supported type. The clipboard is checked at execute time, not during poll.

If the clipboard is not a Nodebin payload, the operator reports "Clipboard is not a Nodebin node tree" and creates nothing.

If `tree_type` does not equal `space_data.tree_type`, the operator reports both types, for example "Copied from a shader tree. This editor is geometry nodes." and creates nothing.

## Where nodes land

The center of the pasted root graph is `space_data.cursor_location`. Each root node with no parent is shifted by `cursor_location - origin.selection_center`. Nodes inside a group tree keep the locations stored on that group. The group instance in the root is shifted with the rest of the root.

The operator sets `bl_options = {"REGISTER", "UNDO"}` so one Ctrl/Cmd+Z removes the whole paste.

## Order of creation

Expected skips (unknown type, unknown socket, missing image, missing property) do not abort the paste. An unexpected exception is reported and the partial nodes remain so the user can undo.

1. **Groups first.** For every distinct `group_tree_id` reachable from the tree, create the group data-block before any instance. Create inner groups before outer ones. `bpy.data.node_groups.new(name, tree_type)` uses the payload tree type. The name is the payload name when it is free. When it is taken, Blender's usual suffix applies (`.001`). Never edit a group that already existed.
2. **Interface.** Walk interface items in order. A panel item creates a panel. A socket item calls `interface.new_socket(name, in_out=..., socket_type=...)`, then sets default, min, max, and hide_value. Do not call `node_tree.inputs.new`.
3. **Zone inputs.** Create zone-input nodes before their outputs when the catalog says `auto_creates_pair`. If `nodes.new` on the input already created the output, adopt that node as the pair and do not call `nodes.new` for the output. Match the adopted node by `bl_idname`. If no output appeared, create it from the payload.
4. **Remaining nodes.** `nodes.new(bl_idname)`. On failure, record a skip and continue. Build the id map from payload id to live node as each node appears.
5. **Socket-layout properties.** Set `affects_sockets` properties before any other property, enums first. Then set the remaining entries in `properties`. A property the live node does not have is a skip. An enum identifier the running Blender does not know is a skip.
6. **Widgets.** Ramps: add or remove elements until the count matches, then set position and color on each. Curves: set clip and extend, then add or remove points until each curve matches, including `handle_type`. Images: if `bpy.data.images` contains `widgets.image.name`, assign it. Otherwise skip and leave the image empty.
7. **Sockets.** After properties, set `default_value`, `hide`, and `hide_value` on the live socket resolved by identifier, then name, then index. Skip sockets the live node does not have.
8. **Parents.** Set `parent` only after both nodes exist. Then assign `location`. Root nodes with no parent receive the cursor shift. A child uses the stored parent-relative `location` with no extra shift. The parent already carries the shift, and children follow. Set frame `width`, `height`, `label_size`, `shrink`, and `text`.
9. **Flags.** `label`, `mute`, `hide`, `hide_unused_sockets`, `width`, `use_custom_color`, and `color`.
10. **Links.** Resolve nodes through the id map. Resolve sockets by identifier, then name, then index. `tree.links.new(from_socket, to_socket)`. Set `is_muted` when the payload says so and the live link has that field. A failed link is a skip.
11. **Names.** Try to set `node.name` to the payload name when that name is free. Never rename a node the user already had.
12. **Selection.** Deselect the previous selection. Select the pasted root nodes.

Group interiors run steps 3 through 11 inside the new group, with no cursor shift.

## Report

One info report when at least one node was created: "Pasted 12 nodes and 9 links." When anything was skipped, append "Skipped 2 nodes and 1 link." The N-panel lists each skip with the `bl_idname` or socket identifier and a reason: `unknown type`, `unknown socket`, `image not in this file`, or `property missing`.

Zero nodes created and at least one skip is a warning, not a success.

## Same-version guarantee

On the Blender version that produced the payload, for built-in nodes:

- Every copied `bl_idname` exists after paste.
- Every stored link whose sockets still exist on those types is recreated.
- Ramp element counts match.
- Curve point counts match.
- A group interface has the same socket names in the same order.
- Mute, label, custom color, and frame parenting match.

Float values match within 1e-5.

## Cross-version

Use the catalog PID's skip rules. The paste still finishes. The report lists what was dropped. One unknown node does not block the nodes that the running Blender can create.

## Blender's own paste

Ctrl/Cmd+V stays `bpy.ops.node.clipboard_paste`. That reads the on-disk copy buffer from the last native copy in any Blender on this machine. Nodebin Paste does not call it for a `nodebin 1` clipboard, because the browser round trip has only the JSON. The JSON procedure above is what runs.

When vault sync has stored the copy-buffer `.blend` for that same Blender version, a later paste-from-link may write that file to the copy-buffer path and call `bpy.ops.node.clipboard_paste`. That path is specified in the sharing PID. It is not required for the core loop.

## What paste does not do

- It does not download a URL. The sharing PID's "paste from link" action fetches text and then calls this operator.
- It does not delete nodes that were already in the tree.
- It does not switch the editor's tree type.
- It does not execute drivers or scripts.

## Acceptance

- A fixture copied from a shader tree, pasted into an empty shader tree in a new file, recreates the links and a ramp.
- That fixture pasted into a geometry-node editor creates no nodes and names both tree types.
- A payload whose group name already exists creates a second group and leaves the original group untouched.
- A payload with one unknown `bl_idname` pastes the other nodes and lists the unknown one.
- One Ctrl/Cmd+Z removes the entire paste.
- Ctrl/Cmd+V still performs Blender's own paste.
