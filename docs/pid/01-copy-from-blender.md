# PID — Copy from Blender

Primary. This is the first half of the core loop: a selection in a node editor becomes a `nodebin 1` clipboard payload. The payload shape is owned by the interchange PID. The keymap and panel are owned by the add-on PID.

## Who can run it

The operator polls true when:

- The active area is a node editor.
- `space_data.node_tree` is not None.
- `space_data.tree_type` is `ShaderNodeTree`, `GeometryNodeTree`, or `CompositorNodeTree`.
- The tree is editable (`space_data.node_tree.is_editable` when that flag exists).
- At least one node is selected.

Otherwise the menu item is disabled. The status text names the missing condition: no node tree, unsupported editor, or nothing selected.

## What Blender already copies

Blender 5.x node Copy (Ctrl/Cmd+C, `bpy.ops.node.clipboard_copy`) keeps a real copy of the selection. Since the January 2026 change (the behavior documented in the Blender 5.2 manual), that operator writes the selection into a temporary node tree and saves it with `PartialWriteContext` to a session copy-buffer file. Paste in another Blender on the same machine reads that file. Images referenced by the nodes are included. Scenes referenced by a Render Layers node are not fully copied.

That file is a `.blend` fragment. `bpy.ops.node.clipboard_copy` is still documented as the internal clipboard. It does not write `window_manager.clipboard`. Pasting into a browser after Ctrl/Cmd+C yields nothing the graph visualizer can draw.

Nodebin does not replace that operator. Nodebin Copy adds the text payload the browser needs, and it asks Blender to refresh its own copy buffer so the two stay aligned.

## What the user does

1. Select the nodes they want to share. Frames, reroutes, groups, and zone ends are selected the same way as any other node.
2. Run Nodebin: Copy from the node editor's Nodebin menu, the N-panel, or Ctrl/Cmd+Shift+C.
3. The system clipboard holds the `nodebin 1` payload. A report says how many nodes were copied and the tree type.

Native Ctrl/Cmd+C is unchanged and still only refreshes Blender's copy buffer.

## Selection rules

Start with every selected node in the open tree.

Then add nodes the selection cannot live without:

- The other end of a zone, when one end is selected. Also include nodes that sit inside the zone when Blender exposes them as linked only through that pair. Record the pair using the catalog's `pair_property` for this Blender version. If the catalog has no pair metadata yet, include a selected zone end and the node its pair pointer references, and follow links between those two nodes.
- The parent frame of a selected node, so children do not arrive without their frame. Unselected siblings in that frame stay behind. The frame is copied with the selected children only.
- For a selected group node (`ShaderNodeGroup`, `GeometryNodeGroup`, `CompositorNodeGroup`), include that group's node tree as another entry in `trees`, and walk groups nested inside it. The inner nodes do not need to be selected. Copying a group node copies the whole group definition.

A wire to a node that is still outside the set after these rules is omitted from `links`. Copy does not pull that node in.

## Capture procedure

1. Call `bpy.ops.node.clipboard_copy()` so Blender writes its copy buffer for this selection. If the operator cancels, Nodebin Copy cancels too and shows Blender's report. Nodebin does not try to read that `.blend` back in the core loop. The path comes from Blender's `node_copybuffer_filepath_get` in `source/blender/editors/space_node/clipboard.cc` and is not a Python API. Vault sync, in the sharing PID, may attach that file when the path can be resolved for the running version.
2. Read `bpy.app.version` and `bpy.app.version_string`.
3. Build the node set with the rules above.
4. Assign payload ids. Root nodes are `n1`, `n2`, … in a stable order: ascending `location_absolute.y`, then ascending `location_absolute.x`, then `name`. The same selection must produce the same JSON except `copied_at`.
5. Compute `origin.selection_center` from the axis-aligned box of `location_absolute` of the root nodes.
6. For each node, write the node object defined in the interchange PID.
7. Property diffs are measured against a fresh node of the same `bl_idname` created in a throwaway tree, then deleted. If creating a fresh node fails, store every writable property and add a warning naming the `bl_idname`.
8. Properties flagged `affects_sockets` in the vendored catalog for this Blender version are always stored. If no catalog is vendored yet, store every enum and every boolean as well, so socket layout still round-trips.
9. Write widgets for color ramps, curve mappings, and images as specified in the interchange PID.
10. Write links whose both ends are in the node set.
11. For each included group, append a tree. Group interface items come from `node_tree.interface.items_tree` in order. Use `in_out` on each socket. Do not read `node_tree.inputs` or `node_tree.outputs`. Those collections are the pre-4.0 API and are absent on current Blender.
12. Serialize with the canonical key order from the interchange PID, prefix `nodebin 1\n`, and assign `context.window_manager.clipboard`.

Group tree ids are `group:` plus the data-block name. A group data-block used twice is stored once and referenced twice via `group_tree_id`.

## Location fields

Write both:

- `location` as Blender stores it (parent-relative inside a frame).
- `location_absolute` from `node.location_absolute`.

The browser draws `location_absolute`. Paste in Blender parents frames first and then assigns `location`.

## Nodes that need extra fields

| Node | Extra capture |
| --- | --- |
| `NodeFrame` | `height`, `label_size`, `shrink`, `text` when the property exists. |
| `NodeReroute` | Sockets only. Blender types the reroute from the link. Store whatever socket types it currently has. |
| Group node | `group_tree_id`. |
| Zone end | `zone_pair_id`, and the pair node included in the set. |
| Any node with an `image` pointer | `widgets.image` name, filepath, source, colorspace. No pixels. |
| Nodes with `color_ramp` or `mapping` | The matching widget object. |

A node that raises while reading one property still enters the payload. The failed property is omitted and listed in `origin.warnings`, an array of `{ "node_id", "property", "message" }`. `origin.warnings` is omitted when empty. Copy does not fail the whole selection because one property was unreadable.

## Clipboard size

After serialization, if the text exceeds 2 MB, still copy it, and warn with the size. Pixels are not in the payload. The usual cause is a deep group. The user can copy a smaller selection.

## What copy does not do

- It does not upload.
- It does not open a browser.
- It does not modify the user's node tree or selection.
- It does not pack the `.blend`.
- It does not write a file unless the user invokes Save in the add-on PID.

## Acceptance

From a shader editor and from a geometry-node editor:

- Two linked nodes produce a payload whose single link resolves by socket identifier.
- A node inside a frame keeps `parent_id`, and `location` differs from `location_absolute` when the frame is not at the origin.
- A group node produces a second tree, and that tree's interface lists the group's inputs and outputs in Blender's order.
- A color ramp with three stops stores three elements with positions and RGBA colors.
- Copying the same selection twice yields JSON that is identical after removing `copied_at`.
- A link to an unselected node outside a frame is absent from `links`.
- Ctrl/Cmd+C still performs Blender's own copy.
