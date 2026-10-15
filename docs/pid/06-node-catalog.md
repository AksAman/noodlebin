# PID — Node catalog

Primary. The catalog is the registry a Blender version contributes to Nodebin. The graph visualizer uses it to draw nodes it has never had handwritten code for. The add-on uses it when pasting a tree that was copied on a different Blender version.

Same-version paste does not require the catalog. The payload already contains the instance sockets and the property overrides. See the interchange PID.

## Why a registry exists

Blender's node set changes every release: new geometry nodes, new sockets (menu, bundle, closure), renamed defaults, moved categories. The browser cannot link against `bpy`. It needs a snapshot of that version's nodes, taken from that version's binary, so a release is absorbed by data rather than by a new React component per node.

Reading Blender's C or Python source is a fallback for theme defaults when a headless run cannot load a preference theme. The binary is the authority. The RNA in that process is the API artists have.

## The release command

When a Blender version ships, run that version's binary:

```bash
blender --background --python scripts/extract_node_catalog.py -- --out catalog/versions
```

The script writes `catalog/versions/<blender_version_string>/catalog.json` and exits 0. `<blender_version_string>` is `bpy.app.version_string` with spaces replaced by `_`. Commit the directory. Ship it with the web app and vendor it in the add-on build for the versions the add-on declares.

No application code change is required for a node the generic view can draw. A node that needs a new widget kind is listed in the script's stdout under `new_widget_hints` and still gets a `generic` entry so it remains visible.

Run the command once per supported version. Keep every directory. A payload's `blender_version` selects the directory. If the exact string is missing, the loader picks the catalog with the same major and minor and the nearest patch, and the UI says which version it used. If no catalog shares major.minor, the graph still draws from the sockets inlined in the payload, with neutral header colors, and the UI says this Blender version has not been extracted.

## What one catalog contains

```json
{
  "blender_version": [5, 0, 1],
  "blender_version_string": "5.0.1",
  "extracted_at": "2026-10-15T18:00:00Z",
  "themes": {},
  "socket_colors": {},
  "categories": [],
  "nodes": {},
  "skipped": []
}
```

### Themes

Walk `bpy.context.preferences.themes[0].node_editor`. Store every float-array color field by its RNA identifier: `shader_node`, `geometry_node`, `compositor_node`, `converter_node`, `input_node`, `output_node`, `color_node`, `vector_node`, `filter_node`, `texture_node`, `group_node`, `layout_node`, `wire`, `wire_inner`, `grid`, and the rest that exist on that version. Values are linear RGB triples as Blender stores them. Also store `node_backdrop` if present.

If preferences are unavailable in background mode, start Blender once with a factory startup file (`blender --background --factory-startup`) and read the theme there. Source parsing is the last resort, and the script records `"theme_source": "factory" | "binary" | "source"` so the snapshot is honest.

### Socket colors

For each concrete `NodeSocket` subclass the extraction touches, store `socket_colors[bl_idname]` as an RGBA or RGB triple. Method, in order:

1. Create a node that has that socket and call the socket draw-color API if it returns without a window.
2. Otherwise use the theme color Blender assigns to that socket class, when the theme exposes one.
3. Otherwise store `[0.63, 0.63, 0.63]` and add the `bl_idname` to `socket_colors_unresolved`.

### Categories

Discover categories from the add menus registered in that binary. Do not hardcode `NODE_MT_category_SH_NEW` or any identifier from a previous release.

Algorithm:

1. For each tree type, create a throwaway node group `bpy.data.node_groups.new("_nodebin_catalog", tree_type)`.
2. Find the add menu for that editor. Prefer the menu class the node editor uses for Shift+A in that tree type. Search `bpy.types` for `Menu` subclasses whose `bl_idname` the node editor's `draw` references, or whose poll accepts this tree type.
3. Walk the menu's `layout` by invoking its `draw` into a dummy layout is not possible without a UI. Instead, read the menu class's Python `draw` only as a hint. The reliable list is the set of node types the menu operators add: collect `bl_idname` values from `bpy.ops.node.add_node` enum items available for this tree, and from any `nodeitems` or asset menus that version exposes.
4. If that yields an empty set, fall back to concrete subclasses of `ShaderNode`, `GeometryNode`, or `CompositorNode` whose `poll` or `poll_instance` accepts the throwaway tree. Those nodes land in a category id `UNCATEGORIZED`.
5. Each category record is `{ "tree_type", "id", "label", "nodes": [bl_idname, ...] }`.

A node that appears in two categories is listed twice. The node record itself is stored once.

### Node records

For each `bl_idname`, on the throwaway tree:

1. `node = tree.nodes.new(bl_idname)`.
2. If that raises, append `{ "bl_idname", "error" }` to `skipped` and continue.
3. Record the fields below.
4. For the zone check, see Zones.
5. `tree.nodes.remove(node)` unless the zone check says Blender already removed a paired node. Then remove whatever remains of the pair.

Fields:

| Field | Source |
| --- | --- |
| `bl_idname` | `node.bl_idname` |
| `label` | `node.bl_label` |
| `description` | RNA description |
| `tree_types` | Which throwaway trees accepted `nodes.new` |
| `category_id` | First category that listed it |
| `header_color` | Theme key for this class. Map the node's RNA base class to the theme field Blender's draw code uses (`ShaderNode` → `shader_node`, and so on). When the class is ambiguous, use `layout_node`. |
| `width_default` | `node.width` immediately after creation |
| `inputs`, `outputs` | Same socket shape as the interchange format, taken from the fresh node |
| `properties` | Editable, non-readonly RNA properties that are not in the denylist |
| `widget` | One of the widget ids below |

Property record:

| Field | Meaning |
| --- | --- |
| `identifier` | RNA identifier |
| `type` | `FLOAT`, `INT`, `BOOLEAN`, `ENUM`, `STRING`, `FLOAT_ARRAY`, or `POINTER` |
| `default` | JSON value |
| `enum_items` | `[{ "identifier", "name" }]` for enums |
| `min`, `max`, `soft_min`, `soft_max`, `step`, `precision` | When RNA defines them |
| `affects_sockets` | Boolean, measured by the probe below |
| `array_length` | For float arrays |

Denylist, never catalogued as settable properties: `rna_type`, `inputs`, `outputs`, `internal_links`, `parent`, `location`, `location_absolute`, `dimensions`, `width`, `height`, `name`, `label`, `mute`, `hide`, `hide_unused_sockets`, `use_custom_color`, `color`, `select`, `show_options`, `show_preview`, `show_texture`, plus any identifier starting with `bl_` or `_`.

Widget id, chosen from the property types present:

| Condition | `widget` |
| --- | --- |
| Has a `ColorRamp` property | `color_ramp` |
| Has a `CurveMapping` property | `curve_mapping` |
| Has an `Image` pointer | `image` |
| `bl_idname` is `NodeFrame` | `frame` |
| `bl_idname` is `NodeReroute` | `reroute` |
| `bl_idname` ends with `NodeGroup` | `group` |
| Zone pair detected | `zone` |
| Otherwise | `generic` |

`generic` still draws enum, boolean, float, int, vector, and color properties. Those are property renderers inside the generic view, not separate catalog widget ids.

### Socket-layout probe

Some nodes rebuild sockets when an enum changes (Math, Map Range, Switch, Mix, menu sockets). The probe:

1. Create the node.
2. Snapshot the list of input and output identifiers.
3. For each enum property, for each enum item, assign the item, snapshot again, then restore the original value.
4. If any snapshot differs, set `affects_sockets` true on that property.
5. For boolean properties, toggle once and do the same.

The copy path always writes properties with `affects_sockets` true into the payload, even when the value equals the default. Paste applies those properties before it writes socket default values.

The probe does not try every combination of properties. A node whose sockets depend on two enums at once still round-trips, because the payload stores the instance socket list after the user's actual mode was set. The flag exists so paste sets the mode before it touches sockets.

### Zones

After `nodes.new(bl_idname)`:

- If a second node appeared in the tree, record both `bl_idname`s, set `widget` to `zone` on each, and record `auto_creates_pair`: the other `bl_idname`.
- If the node has a pointer property to a paired output or input, record that property name as `pair_property`.

Paste uses `auto_creates_pair` so it does not create the second node twice. The measurement is per Blender version because pair behavior has changed before.

### Cleanup

Remove the throwaway node group. Remove any images, materials, or meshes the script created. The script does not save a `.blend`.

## How the visualizer joins catalog and payload

For each instance node:

1. Look up `nodes[bl_idname]` in the catalog selected for the payload's Blender version.
2. Header color comes from `themes[header_color]`. Missing key: `[0.25, 0.25, 0.25]`.
3. Socket rows come from the instance `sockets` list, not from the catalog's fresh-node list. The catalog supplies the color for each socket `bl_idname`.
4. Property rows come from the catalog property list, with values from the payload overrides, otherwise the catalog default. Properties that `affects_sockets` and that are not the active mode are still shown at the payload value.
5. Widget body (`color_ramp`, `curve_mapping`, `image`) comes from `payload.widgets`.
6. No catalog entry: draw a generic node from the instance sockets and properties only, header `[0.2, 0.2, 0.2]`, title `label` or `bl_idname`.

Group nodes ignore the catalog socket list and use the interface of `group_tree_id`.

## Add-on use on cross-version paste

Load the source catalog (payload version) and the running catalog (`bpy.app.version`).

- `bl_idname` missing in the running catalog and `nodes.new` fails: skip the node, name it in the report.
- Property present in the payload and absent on the live node: skip the property.
- Property with `affects_sockets` in the source catalog: set it before socket defaults, even if the running catalog forgot the flag.
- Socket identifier missing on the live node: skip that default and any link to that socket, and name the socket in the report.

## Acceptance

- Extracting a version produces a non-empty `nodes` map for all three tree types and a non-empty `themes` map.
- `ShaderNodeBsdfPrincipled` or its successor on that version has a `shader_node` header key and more than one input.
- A geometry-node math or switch node that changes sockets is flagged `affects_sockets` on the enum that does it.
- A second extract of the same binary writes identical JSON except `extracted_at`.
- Adding a fictional catalog entry with a new `bl_idname`, two float sockets, and `widget` `generic` is enough for the graph visualizer to draw it when a payload references that id. No renderer file is edited.
