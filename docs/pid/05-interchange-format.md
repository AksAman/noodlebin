# PID — Interchange format

Primary. This document owns the clipboard payload. Copy, paste, the graph visualizer, sharing, and embedding all read and write this format and no other.

## Envelope

The system clipboard holds UTF-8 text:

```text
nodevault 1
{ ...json... }
```

Line 1 is exactly `nodevault 1` (the format version), with no spaces before it and a single newline after it. The rest of the clipboard is one JSON object. Parsers accept a missing trailing newline. Parsers reject a different magic, including `nodevault 2`, until a migration exists.

A file saved from the browser uses the extension `.nodevault.json` and contains the same text, magic line included.

The JSON object:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `format` | string | yes | Always `nodevault.tree`. |
| `format_version` | number | yes | Always `1` for this PID. |
| `blender_version` | `[major, minor, patch]` | yes | `bpy.app.version` at copy time. |
| `blender_version_string` | string | yes | `bpy.app.version_string`, display only. |
| `tree_type` | string | yes | `ShaderNodeTree`, `GeometryNodeTree`, or `CompositorNodeTree`. |
| `copied_at` | string | yes | ISO-8601 UTC. |
| `origin` | object | yes | Selection geometry. See below. |
| `trees` | array | yes | One or more trees. The root is the copied selection. Further entries are node groups referenced by the selection, depth-first, each group before any tree that only exists inside it. |

`origin`:

| Field | Type | Meaning |
| --- | --- | --- |
| `selection_center` | `[x, y]` | Center of the axis-aligned box of `location_absolute` of the copied root nodes, in Blender coordinates (Y up). |
| `node_count` | number | Count of nodes in the root tree entry, not counting nodes inside groups. |

There is no field for thumbnails, author, or video. Those belong to the sharing PID and travel beside this payload, never inside it.

## Trees

```json
{
  "id": "root",
  "name": "Shader Nodetree",
  "is_root": true,
  "nodes": [],
  "links": [],
  "interface": []
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique inside this payload. The root is always `root`. Group trees use `group:` plus the Blender node-group name at copy time, with a numeric suffix if that id already exists. |
| `name` | Blender data-block name. |
| `is_root` | True for exactly one tree. |
| `interface` | Group sockets, in Blender's interface order. Empty for the root when the root is a material, geometry-node modifier, or scene compositor rather than a group. Present for every `group:` tree. |

Interface item:

| Field | Meaning |
| --- | --- |
| `identifier` | Stable socket identifier. |
| `name` | Display name. |
| `socket_type` | Socket `bl_idname`, such as `NodeSocketFloat`. |
| `in_out` | `INPUT` or `OUTPUT`. |
| `description` | String, possibly empty. |
| `default_value` | JSON number, boolean, string, or array. Omitted when the socket type has no default. |
| `min`, `max` | Present for numeric sockets when Blender exposes them. |
| `hide_value` | Boolean. |
| `parent_identifier` | Set when the socket lives in an interface panel. The panel itself is an item with `item_type` `PANEL` and no `socket_type`. |

## Nodes

```json
{
  "id": "n1",
  "bl_idname": "ShaderNodeTexNoise",
  "name": "Noise Texture",
  "label": "",
  "location": [-300.0, 0.0],
  "location_absolute": [-300.0, 0.0],
  "width": 140.0,
  "parent_id": null,
  "mute": false,
  "hide": false,
  "hide_unused_sockets": false,
  "use_custom_color": false,
  "color": null,
  "properties": {},
  "widgets": {},
  "sockets": { "inputs": [], "outputs": [] },
  "group_tree_id": null,
  "zone_pair_id": null
}
```

| Field | Rule |
| --- | --- |
| `id` | `n` plus a counter, unique per tree. Links use this id, never the Blender name. |
| `bl_idname` | The type passed to `nodes.new`. |
| `name` | Blender's node name at copy time. Paste treats it as a label hint. Blender may rename on collision. |
| `label` | The user-facing label. Empty string when unset. |
| `location` | `node.location`, which is parent-relative when `parent_id` is set. |
| `location_absolute` | `node.location_absolute`. The browser draws this, then flips Y. |
| `width` | `node.width`. Frames also store `height`. Other nodes omit `height`. |
| `parent_id` | Id of a `NodeFrame` in the same tree, or null. |
| `mute`, `hide`, `hide_unused_sockets` | Booleans copied from the node. |
| `use_custom_color` | Boolean. |
| `color` | `[r, g, b]` or `[r, g, b, a]` when custom color is on. Otherwise null. |
| `properties` | Map of RNA identifier to a JSON value. See the property rules. |
| `widgets` | Structured values for ramps, curves, and images. |
| `sockets` | The instance's sockets, in order. |
| `group_tree_id` | Set on `ShaderNodeGroup`, `GeometryNodeGroup`, and `CompositorNodeGroup` to a tree id in this payload. |
| `zone_pair_id` | The node id of the other end of a simulation, repeat, foreach, or closure zone, when this node is one end. |

Node ids are unique within a tree, not across trees.

### What goes in `properties`

Compare the live node to a node freshly created with the same `bl_idname` in the same Blender.

Include a property when any of these is true:

- The value differs from the fresh node.
- The catalog marks the property `affects_sockets`.
- The property is an enum or boolean and the fresh-node comparison could not be made.

Exclude:

- Callables, RNA pointers to other data-blocks (images and node trees have their own fields), `inputs`, `outputs`, `internal_links`, `parent`, `location`, `dimensions`, `width`, `height`.
- Names starting with `_` or `bl_`.
- Properties whose RNA `is_readonly` is true, except those listed as widgets.

Arrays become JSON arrays. Vectors become `[x, y, z]`. Eulers and colors become arrays of floats. Enums become their identifier string, not the integer. Floats are JSON numbers rounded to 6 decimal places. Integers stay integers. Booleans stay booleans.

### Sockets

Every input and output that exists on the instance at copy time is stored, including sockets at their default value. The instance list is the authority for what the node looked like, because enum modes add and remove sockets.

```json
{
  "identifier": "Scale",
  "name": "Scale",
  "label": "",
  "bl_idname": "NodeSocketFloat",
  "type": "VALUE",
  "index": 2,
  "default_value": 5.0,
  "hide": false,
  "hide_value": false,
  "enabled": true
}
```

`default_value` is omitted when the socket type has none (shader closures, geometry, virtual). A vector or color default is an array. `index` is the index in `node.inputs` or `node.outputs` at copy time.

Virtual sockets (`NodeSocketVirtual`) are omitted.

### Widgets

`widgets` is an object keyed by the RNA identifier of the widget property.

Color ramp (`color_ramp`):

```json
{
  "color_mode": "RGB",
  "interpolation": "LINEAR",
  "hue_interpolation": "NEAR",
  "elements": [
    { "position": 0.0, "color": [0, 0, 0, 1] },
    { "position": 1.0, "color": [1, 1, 1, 1] }
  ]
}
```

Curve mapping (`mapping`), used by RGB Curves, Float Curve, and Vector Curves:

```json
{
  "use_clip": true,
  "clip_min_x": 0.0,
  "clip_min_y": 0.0,
  "clip_max_x": 1.0,
  "clip_max_y": 1.0,
  "extend": "EXTRAPOLATED",
  "curves": [
    {
      "points": [
        { "location": [0.0, 0.0], "handle_type": "AUTO" },
        { "location": [1.0, 1.0], "handle_type": "AUTO" }
      ]
    }
  ]
}
```

Point `location` is `[x, y]`. Include every curve Blender exposes on that mapping (four for RGB, one for a float curve, three for a vector curve).

Image (`image`):

```json
{
  "name": "bark.png",
  "filepath": "//textures/bark.png",
  "source": "FILE",
  "colorspace": "sRGB"
}
```

Pixel blocks are not part of format version 1. The graph shows the name. Paste reconnects an image data-block of the same name when one exists in the destination file, and otherwise leaves the image unset and names it in the paste report.

### Zones

A zone is two nodes that Blender treats as a pair (simulation, repeat, foreach, closure). Both nodes are included whenever either would be included by the selection rules in the copy PID. Each stores `zone_pair_id` pointing at the other. State or inspection sockets that only exist because of the zone are ordinary sockets on those nodes.

### Frames

A `NodeFrame` is a node. It additionally stores:

| Field | Meaning |
| --- | --- |
| `height` | Frame height. |
| `label_size` | Font size. |
| `shrink` | Boolean. |
| `text` | Frame body text, when that RNA property exists. |

Children point at the frame with `parent_id`. Their `location` stays parent-relative.

## Links

```json
{
  "id": "l1",
  "from_node": "n1",
  "from_socket": { "identifier": "Fac", "name": "Fac", "index": 0 },
  "to_node": "n2",
  "to_socket": { "identifier": "Roughness", "name": "Roughness", "index": 9 },
  "is_muted": false
}
```

Links are stored on the tree, once each. A link whose endpoints are both in the copied node set is stored. A link with one end outside the set is dropped. Muted links are stored with `is_muted` true. Invalid links (`link.is_valid` false) are dropped.

Socket identity on paste is resolved in order: `identifier`, then `name`, then `index`.

## Worked example

A noise texture feeding the roughness of a Principled BSDF. Floats in the real payload are the node's actual defaults; the values below are illustrative.

```json
{
  "format": "nodevault.tree",
  "format_version": 1,
  "blender_version": [5, 0, 1],
  "blender_version_string": "5.0.1",
  "tree_type": "ShaderNodeTree",
  "copied_at": "2026-10-15T18:00:00Z",
  "origin": { "selection_center": [-150.0, 0.0], "node_count": 2 },
  "trees": [
    {
      "id": "root",
      "name": "Shader Nodetree",
      "is_root": true,
      "interface": [],
      "nodes": [
        {
          "id": "n1",
          "bl_idname": "ShaderNodeTexNoise",
          "name": "Noise Texture",
          "label": "",
          "location": [-300.0, 0.0],
          "location_absolute": [-300.0, 0.0],
          "width": 140.0,
          "parent_id": null,
          "mute": false,
          "hide": false,
          "hide_unused_sockets": false,
          "use_custom_color": false,
          "color": null,
          "properties": {},
          "widgets": {},
          "sockets": {
            "inputs": [
              {
                "identifier": "Scale",
                "name": "Scale",
                "label": "",
                "bl_idname": "NodeSocketFloat",
                "type": "VALUE",
                "index": 2,
                "default_value": 5.0,
                "hide": false,
                "hide_value": false,
                "enabled": true
              }
            ],
            "outputs": [
              {
                "identifier": "Fac",
                "name": "Fac",
                "label": "",
                "bl_idname": "NodeSocketFloat",
                "type": "VALUE",
                "index": 0,
                "hide": false,
                "hide_value": false,
                "enabled": true
              }
            ]
          },
          "group_tree_id": null,
          "zone_pair_id": null
        },
        {
          "id": "n2",
          "bl_idname": "ShaderNodeBsdfPrincipled",
          "name": "Principled BSDF",
          "label": "",
          "location": [0.0, 0.0],
          "location_absolute": [0.0, 0.0],
          "width": 240.0,
          "parent_id": null,
          "mute": false,
          "hide": false,
          "hide_unused_sockets": false,
          "use_custom_color": false,
          "color": null,
          "properties": {},
          "widgets": {},
          "sockets": {
            "inputs": [
              {
                "identifier": "Roughness",
                "name": "Roughness",
                "label": "",
                "bl_idname": "NodeSocketFloatFactor",
                "type": "VALUE",
                "index": 9,
                "default_value": 0.5,
                "hide": false,
                "hide_value": false,
                "enabled": true
              }
            ],
            "outputs": []
          },
          "group_tree_id": null,
          "zone_pair_id": null
        }
      ],
      "links": [
        {
          "id": "l1",
          "from_node": "n1",
          "from_socket": { "identifier": "Fac", "name": "Fac", "index": 0 },
          "to_node": "n2",
          "to_socket": { "identifier": "Roughness", "name": "Roughness", "index": 9 },
          "is_muted": false
        }
      ]
    }
  ]
}
```

A real copy stores every socket on those nodes, not only Scale, Fac, and Roughness. This example is shortened to show the shape.

## Canonical JSON

Before the browser puts the payload back on the clipboard, it parses the JSON and serializes it with object keys in the order given in this PID, 2-space indent, and a trailing newline after the JSON. The magic line is prepended. Key order inside `properties` and `widgets` follows the order Blender reported at copy time, which the payload already has, and the canonical serializer preserves that order. Numbers stay numbers. This makes the copy-back stable without dropping fields the schema has never heard of: unknown keys are preserved and emitted after the known keys.

## Validation

A payload is acceptable when:

- The magic and `format_version` match.
- `tree_type` is one of the three supported strings.
- Exactly one tree has `is_root` true and `id` `root`.
- Every `parent_id`, `group_tree_id`, `zone_pair_id`, and link endpoint refers to an id that exists in the same tree (groups: `group_tree_id` refers to another tree in `trees`).
- Every link's sockets refer to identifiers present on those nodes.
- `blender_version` has three non-negative integers.

A failed check produces a named error. The browser shows it above an empty canvas. Blender shows it in a popup and creates no nodes.

## Versioning

`format_version` increments only when a parser of the previous version would misread a payload. Adding an optional field is not a version bump. The catalog is not part of this version. A payload from Blender 5.0 and a payload from Blender 5.1 share `format_version` 1.
