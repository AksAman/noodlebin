import type { Catalog } from "@noodlebin/catalog"
import { socketColor, widgetId } from "@noodlebin/catalog"
import type { NoodleBinTree } from "@noodlebin/interchange"
import type { Edge, Node } from "@xyflow/react"
import { cssThemeColor } from "./color"
import {
  blenderToCanvas,
  estimatedHeight,
  handleId,
  linkedInputIds,
  nodeWidth,
} from "./layout"
import { zoneCaption } from "./NvNode"
import type { NvKind, NvNodeData } from "./types"

function asKind(raw: string): NvKind {
  if (raw === "frame" || raw === "reroute" || raw === "group" || raw === "zone") return raw
  return "generic"
}

function zoneBoxes(tree: NoodleBinTree, catalog: Catalog | null): Node<NvNodeData>[] {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  const boxes: Node<NvNodeData>[] = []
  for (const node of tree.nodes) {
    if (!node.zone_pair_id || seen.has(node.id)) continue
    const pair = byId.get(node.zone_pair_id)
    if (!pair) continue
    seen.add(node.id)
    seen.add(pair.id)
    const involved = [node, pair]
    for (const other of tree.nodes) {
      if (other.id === node.id || other.id === pair.id) continue
      const [x, y] = other.location_absolute
      const ax = Math.min(node.location_absolute[0], pair.location_absolute[0])
      const ay = Math.min(node.location_absolute[1], pair.location_absolute[1])
      const bx = Math.max(node.location_absolute[0], pair.location_absolute[0])
      const by = Math.max(node.location_absolute[1], pair.location_absolute[1])
      if (x >= ax && x <= bx && y >= ay && y <= by) involved.push(other)
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of involved) {
      const p = blenderToCanvas(n.location_absolute)
      const w = nodeWidth(n)
      const h = estimatedHeight(n, catalog, { texturePreview: true })
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + w)
      maxY = Math.max(maxY, p.y + h)
    }
    const pad = 16
    boxes.push({
      id: `zone:${node.id}:${pair.id}`,
      type: "nv",
      position: { x: minX - pad, y: minY - pad },
      data: {
        payloadNode: node,
        tree,
        catalog,
        linkedInputs: new Set(),
        blenderVersion: "",
        kind: "zone-bg",
        zoneLabel: zoneCaption(node.bl_idname),
      },
      style: {
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
        pointerEvents: "none",
      },
      selectable: false,
      draggable: false,
      deletable: false,
      zIndex: 0,
    })
  }
  return boxes
}

export function treeToFlow(
  tree: NoodleBinTree,
  catalog: Catalog | null,
  blenderVersion: string,
  trees: readonly NoodleBinTree[],
): { nodes: Node<NvNodeData>[]; edges: Edge[] } {
  const zones = zoneBoxes(tree, catalog).map((n) => ({
    ...n,
    data: { ...n.data, blenderVersion },
  }))
  const nodes: Node<NvNodeData>[] = [...zones]
  const byId = new Map(tree.nodes.map((n) => [n.id, n]))
  const depthCache = new Map<string, number>()
  const depth = (id: string, seen = new Set<string>()): number => {
    const cached = depthCache.get(id)
    if (cached !== undefined) return cached
    const parent = byId.get(id)?.parent_id
    const d = parent && byId.has(parent) && !seen.has(parent) ? depth(parent, seen.add(id)) + 1 : 0
    depthCache.set(id, d)
    return d
  }
  /* React Flow needs a parent ahead of its children, so frames sort before what they contain. */
  const ordered = [...tree.nodes].sort((a, b) => depth(a.id) - depth(b.id))
  for (const node of ordered) {
    const kind = asKind(widgetId(catalog, node))
    const abs = blenderToCanvas(node.location_absolute)
    const parent = node.parent_id && depth(node.id) > 0 ? byId.get(node.parent_id) : undefined
    const parentAbs = parent ? blenderToCanvas(parent.location_absolute) : null
    const p = parentAbs ? { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y } : abs
    const groupTree = node.group_tree_id
      ? trees.find((t) => t.id === node.group_tree_id)
      : undefined
    nodes.push({
      id: node.id,
      type: "nv",
      position: p,
      ...(parent ? { parentId: parent.id } : {}),
      data: {
        payloadNode: node,
        tree,
        catalog,
        linkedInputs: linkedInputIds(tree, node.id),
        blenderVersion,
        kind,
        ...(groupTree ? { groupTree } : {}),
      },
      selectable: true,
      draggable: true,
      deletable: false,
      zIndex: kind === "frame" ? 1 : 2,
      style:
        kind === "frame"
          ? { width: node.width, height: node.height ?? 80 }
          : kind === "reroute"
            ? { width: 16, height: 16 }
            : { width: nodeWidth(node) },
    })
  }

  const edges: Edge[] = tree.links.map((link) => {
    const from = tree.nodes.find((n) => n.id === link.from_node)
    const sock = from?.sockets.outputs.find((s) => s.identifier === link.from_socket.identifier)
    const color = cssThemeColor(socketColor(catalog, sock?.bl_idname ?? ""))
    return {
      id: link.id,
      source: link.from_node,
      target: link.to_node,
      sourceHandle: handleId("out", link.from_socket.identifier),
      targetHandle: handleId("in", link.to_socket.identifier),
      selectable: false,
      deletable: false,
      reconnectable: false,
      type: "default",
      style: link.is_muted
        ? { stroke: color, strokeWidth: 2, opacity: 0.5, strokeDasharray: "6 4" }
        : { stroke: color, strokeWidth: 2, opacity: 1 },
    }
  })

  return { nodes, edges }
}
