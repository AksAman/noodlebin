import { headerColor, lookupNode, resolveCatalog, socketColor, widgetId, type Catalog } from "@/catalog"
import type { NoodleBinNode, NoodleBinPayload } from "@/interchange"
import { cssColor, cssThemeColor } from "@/node-view/color"
import { HEADER_H, ROW_H, blenderToCanvas, bounds, estimatedHeight, visibleSockets } from "@/node-view/layout"
import { shippedCatalogs } from "@/lib/catalogs"

const MIN_RATIO = 0.8
const MAX_RATIO = 1.7
const MIN_SPAN = 520

type Box = {
  node: NoodleBinNode
  kind: string
  x: number
  y: number
  w: number
  h: number
  outY: Map<string, number>
  inY: Map<string, number>
}

function measure(node: NoodleBinNode, catalog: Catalog | null): Box {
  const kind = widgetId(catalog, node)
  const { x, y } = blenderToCanvas(node.location_absolute)
  const w = kind === "reroute" ? 16 : kind === "frame" ? node.width : Math.max(140, node.width)
  const h = estimatedHeight(node, catalog)
  const outY = new Map<string, number>()
  const inY = new Map<string, number>()
  if (kind === "reroute") {
    for (const s of node.sockets.outputs) outY.set(s.identifier, y + 8)
    for (const s of node.sockets.inputs) inY.set(s.identifier, y + 8)
    return { node, kind, x, y, w, h, outY, inY }
  }
  const vis = visibleSockets(node)
  const props = lookupNode(catalog, node.bl_idname)?.properties.filter((p) => p.identifier !== "warning_propagation").length ?? 0
  const top = y + HEADER_H + 4 + ROW_H / 2
  vis.outputs.forEach((s, i) => outY.set(s.identifier, top + i * ROW_H))
  const widgets = (node.widgets.color_ramp ? 108 : 0) + (node.widgets.image ? 20 : 0)
  const inTop = top + (vis.outputs.length + props) * ROW_H + widgets
  vis.inputs.forEach((s, i) => inY.set(s.identifier, inTop + i * ROW_H))
  return { node, kind, x, y, w, h, outY, inY }
}

function headerFill(node: NoodleBinNode, kind: string, catalog: Catalog | null): string {
  if (node.use_custom_color && node.color && node.color.length >= 3) return cssColor(node.color)
  if (kind === "group" && catalog?.themes["group_node"]) return cssThemeColor(catalog.themes["group_node"])
  return cssThemeColor(headerColor(catalog, node.bl_idname))
}

function bodyPath(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x} ${y}H${x + w}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}Z`
}

/** A static, non-interactive picture of a payload's root tree, drawn with catalog colors. */
export function GraphThumb({ payload, id }: { payload: NoodleBinPayload; id: string }) {
  const root = payload.trees.find((t) => t.is_root) ?? payload.trees[0]
  if (!root) return null
  const catalog = resolveCatalog(shippedCatalogs, payload.blender_version).catalog ?? null

  let { x, y, width, height } = bounds(root, catalog)
  if (width < MIN_SPAN) {
    x -= (MIN_SPAN - width) / 2
    width = MIN_SPAN
  }
  if (width / height > MAX_RATIO) {
    const h = width / MAX_RATIO
    y -= (h - height) / 2
    height = h
  } else if (width / height < MIN_RATIO) {
    const w = height * MIN_RATIO
    x -= (w - width) / 2
    width = w
  }

  const boxes = new Map(root.nodes.map((n) => [n.id, measure(n, catalog)]))
  const ordered = [...boxes.values()].sort((a, b) => Number(b.kind === "frame") - Number(a.kind === "frame"))
  const dots = `dots-${id}`

  return (
    <svg
      viewBox={`${x} ${y} ${width} ${height}`}
      className="block h-auto w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={dots} width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="2.2" fill="#3a3a3a" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill="#171717" />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${dots})`} />

      {ordered
        .filter((b) => b.kind === "frame")
        .map((b) => (
          <rect
            key={b.node.id}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="6"
            fill={b.node.use_custom_color && b.node.color ? cssColor(b.node.color) : "#303030"}
            fillOpacity={b.node.use_custom_color ? 0.3 : 0.45}
          />
        ))}

      {root.links.map((link) => {
        const from = boxes.get(link.from_node)
        const to = boxes.get(link.to_node)
        if (!from || !to) return null
        const x1 = from.kind === "reroute" ? from.x + 8 : from.x + from.w
        const y1 = from.outY.get(link.from_socket.identifier) ?? from.y + HEADER_H
        const x2 = to.kind === "reroute" ? to.x + 8 : to.x
        const y2 = to.inY.get(link.to_socket.identifier) ?? to.y + HEADER_H
        const dx = Math.max(40, Math.abs(x2 - x1) * 0.5)
        const sock = from.node.sockets.outputs.find((s) => s.identifier === link.from_socket.identifier)
        return (
          <path
            key={link.id}
            d={`M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`}
            fill="none"
            stroke={cssThemeColor(socketColor(catalog, sock?.bl_idname ?? ""))}
            strokeWidth="1.6"
            strokeOpacity={link.is_muted ? 0.4 : 0.95}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}

      {ordered
        .filter((b) => b.kind !== "frame")
        .map((b) => {
          const { node } = b
          if (b.kind === "reroute") {
            return <circle key={node.id} cx={b.x + 8} cy={b.y + 8} r="7" fill="#8a8a8a" />
          }
          const sockets = [
            ...node.sockets.outputs.map((s) => ({ s, cx: b.x + b.w, cy: b.outY.get(s.identifier) })),
            ...node.sockets.inputs.map((s) => ({ s, cx: b.x, cy: b.inY.get(s.identifier) })),
          ]
          return (
            <g key={node.id} opacity={node.mute ? 0.5 : 1}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill={headerFill(node, b.kind, catalog)} />
              <path d={bodyPath(b.x, b.y + HEADER_H, b.w, b.h - HEADER_H, 6)} fill="#303030" />
              {[...b.outY.values(), ...b.inY.values()].map((rowY, i) => (
                <rect key={i} x={b.x + 14} y={rowY - 5} width={b.w * 0.42} height="10" rx="5" fill="#4a4a4a" />
              ))}
              {node.widgets.color_ramp ? (
                <>
                  <defs>
                    <linearGradient id={`ramp-${id}-${node.id}`}>
                      {node.widgets.color_ramp.elements.map((el, i) => (
                        <stop key={i} offset={el.position} stopColor={cssColor(el.color.slice(0, 3))} />
                      ))}
                    </linearGradient>
                  </defs>
                  <rect
                    x={b.x + 12}
                    y={b.y + HEADER_H + 4 + (b.outY.size + 1) * ROW_H}
                    width={b.w - 24}
                    height="36"
                    rx="3"
                    fill={`url(#ramp-${id}-${node.id})`}
                  />
                </>
              ) : null}
              {sockets.map(({ s, cx, cy }) =>
                cy === undefined ? null : (
                  <circle
                    key={`${cx}:${s.identifier}`}
                    cx={cx}
                    cy={cy}
                    r="6"
                    fill={cssThemeColor(socketColor(catalog, s.bl_idname))}
                    stroke="#111"
                    strokeWidth="1.5"
                  />
                ),
              )}
            </g>
          )
        })}
    </svg>
  )
}
