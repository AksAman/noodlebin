# PID — Graph visualizer

Primary. The component that draws a `nodebin.tree` plus a catalog. The paste page, and later the share page and the embed, all mount this component. They do not draw nodes themselves.

Package: `packages/node-view`. It imports the catalog loader and has no dependency on accounts, uploads, or routes.

## Inputs

```ts
type NodeViewProps = {
  tree: NodebinTree
  catalog: Catalog | null
  readOnly: true
  onCopy?: () => void
}
```

`readOnly` is fixed true for the core product. The prop exists so a later editor cannot silently turn the paste page into an editor. When the host passes `onCopy`, the host owns the Copy button. The component emits `requestCopy` when Ctrl/Cmd+C is pressed and no text is selected, so the host can run the copy-from-browser PID.

## Coordinate system

Blender locations are Y-up. The canvas is Y-down. For every node:

```text
x = location_absolute[0]
y = -location_absolute[1]
```

Use `location_absolute`, never `location`, so a node inside a frame lands where it was on screen. The frame is drawn at its own absolute position. Children are not DOM children positioned relative to the frame. Parenting is visual: the frame rectangle sits behind its children, whose absolute positions already fall inside it.

Fit computes the bounding box of those points, plus each node's width and an estimated height, and pads 48 pixels.

## Canvas behavior

- Pan by dragging the background. Zoom by wheel, cursor-centered. Trackpad pinch zooms.
- A minimap sits at the bottom right and can be hidden from the top bar.
- Fit returns to the bounding box. The F key fits when the canvas is focused.
- Double-click a group node to show that group's tree. A breadcrumb lists Root and each open group. A crumb or Escape pops one level.
- The component does not reorder nodes and does not write back into `tree`.

Use current React Flow (`@xyflow/react`) for pan, zoom, and edges, with one custom node renderer. The sample types in `prior_projects/nodebin-visualizer` (`dataNode`, `sourceNode`, `functionNode`, `valueNode`) are not used.

## Look

Match the static mock in `prior_projects/nodebin-visualizer/src/playground` and the theme values from the catalog.

| Element | Rule |
| --- | --- |
| Background | Near `#171717`, dot grid. Use the catalog `grid` color when present. |
| Node body | Near `#303030`, 4 pixel corner radius, width from the payload `width` (minimum 140). |
| Header | 24 pixels tall. Fill is the catalog theme color for `header_color`, converted from linear RGB to CSS. Title is `label` when non-empty, otherwise the catalog `label`, otherwise `name`. |
| Custom color | When `use_custom_color` is true, the header uses `color` instead of the theme. |
| Muted | The node draws at 45% opacity and a 1 pixel line crosses the header. |
| Socket row | 24 pixels. Inputs on the left, outputs on the right. A 9 pixel circle colored from `socket_colors[bl_idname]`. |
| Hidden sockets | `hide` true removes the row. `hide_value` true keeps the row and hides the value. |
| Wires | Cubic bezier from the output circle to the input circle. Stroke is the source socket color, 2 pixels. `is_muted` true uses a dashed stroke at 50% opacity. |
| Hover | The node under the pointer brightens its border. There is no multi-select. |

Convert linear RGB with the sRGB transfer curve before putting it in CSS.

## Generic node body

Under the header, in order:

1. Enum and boolean properties. Values come from the payload when present, otherwise the catalog default. Enums show the item's `name`.
2. Float, int, and vector properties the same way. A float or int with `min` and `max` draws a bar at `(value - min) / (max - min)` clamped to 0–1, plus the number. Vectors show three numbers.
3. Color properties as a 16 pixel swatch.
4. Socket rows. An unlinked input with a `default_value` shows it on the right: swatch for colors, text for numbers and strings, bar for floats with a 0–1 range. A linked input hides the value and keeps the name.
5. Widget blocks under the property list.

Output rows have the name and the circle and no value.

## Widgets

| Widget | Drawing |
| --- | --- |
| `color_ramp` | A horizontal bar. Each element is a stop at `position`. Spans blend linearly between stop colors. Other interpolation modes still draw a linear blend, and the mode name is a caption. This view does not evaluate Blender's shading. |
| `curve_mapping` | One sparkline per curve, about 140 by 48 pixels. Axes run from clip min to clip max when `use_clip` is set, otherwise from the point bounds. The line passes through each `location`. |
| `image` | The image `name`. No pixel decode. |
| `frame` | A labeled rectangle from `width` and `height`. Header text is `label`, or `text` when `label` is empty. Children draw above it. |
| `reroute` | A single circle. Color from the output socket, otherwise the input socket. |
| `group` | Header uses `group_node`. Rows come from the group interface: inputs left, outputs right. The body shows the group name. Double-click opens `group_tree_id`. |
| `zone` | Both ends draw as generic nodes. A translucent rectangle sits behind every node whose absolute position lies in the box that bounds the pair. The caption is the kind inferred from `bl_idname`: Simulation, Repeat, For Each, or Closure. A missing pair draws the single node and skips the rectangle. |
| `generic` | Property rows, socket rows, and nothing else. |

An unknown `widget` string uses `generic`.

## Inspection

Hovering a socket shows `name`, `bl_idname`, and `identifier`. Hovering a node shows `bl_idname` and the payload's Blender version. There is no raw-JSON side panel on the paste page.

## Accessibility

The top bar is focusable. The canvas exposes node names to the accessibility tree in payload id order, each with its `bl_idname`. Wires are not separate accessible objects. F is the keyboard way to fit the view.

## Performance

The 200-node fixture from the paste-in-browser PID pans at interactive rates after the first paint: a drag stays at or above 20 frames per second on a current laptop. One node component branches on `widget`. There is not a component file per `bl_idname`.

## Acceptance

- The two-node fixture shows catalog header colors, a wire from Fac to Roughness, and the Scale value.
- A three-stop ramp shows three stops in order.
- A frame contains its child in the arrangement `location_absolute` describes.
- A reroute is a dot on the wire, not a full card.
- Double-clicking a group shows the inner tree, and Escape returns to the root.
- A `bl_idname` missing from the catalog still shows its inlined sockets.
- With `catalog` null, the same payload draws with neutral headers and the inlined sockets.
