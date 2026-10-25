import type { Catalog } from "@noodlebin/catalog"
import { lookupNode, widgetId } from "@noodlebin/catalog"
import type { NoodleBinNode, NoodleBinTree } from "@noodlebin/interchange"

export const HEADER_H = 24
export const ROW_H = 24
export const MIN_WIDTH = 140
export const FIT_PAD = 48

export function blenderToCanvas(location_absolute: readonly [number, number]): { x: number; y: number } {
  return { x: location_absolute[0], y: -location_absolute[1] }
}

export function visibleSockets(node: NoodleBinNode): { inputs: typeof node.sockets.inputs; outputs: typeof node.sockets.outputs } {
  return {
    inputs: node.sockets.inputs.filter((s) => !s.hide && s.enabled),
    outputs: node.sockets.outputs.filter((s) => !s.hide && s.enabled),
  }
}

export function linkedInputIds(tree: NoodleBinTree, nodeId: string): Set<string> {
  const ids = new Set<string>()
  for (const link of tree.links) {
    if (link.to_node === nodeId) ids.add(link.to_socket.identifier)
  }
  return ids
}

export function nodeTitle(node: NoodleBinNode, catalog: Catalog | null): string {
  if (node.label) return node.label
  const rec = lookupNode(catalog, node.bl_idname)
  if (rec?.label) return rec.label
  return node.name || node.bl_idname
}

export function estimatedHeight(
  node: NoodleBinNode,
  catalog: Catalog | null,
  options?: { texturePreview?: boolean },
): number {
  const kind = widgetId(catalog, node)
  if (kind === "reroute") return 16
  if (kind === "frame") return node.height ?? 80
  const vis = visibleSockets(node)
  const rec = lookupNode(catalog, node.bl_idname)
  const propCount = rec?.properties.filter((p) => p.identifier !== "warning_propagation").length ?? 0
  let extra = 0
  if (node.widgets.color_ramp) extra += 108
  // One curve plot for every channel: 20px toolbar + 2px gap + 160px plot + 3px padding.
  if (node.widgets.mapping) extra += 185
  if (node.widgets.image) extra += 20
  if (kind === "group") extra += 20
  if (
    options?.texturePreview &&
    (node.bl_idname === "ShaderNodeTexNoise" || node.bl_idname === "ShaderNodeTexVoronoi")
  ) {
    extra += nodeWidth(node) - 8
  }
  const socketRows =
    vis.inputs.length > 0 && vis.outputs.length > 0
      ? vis.inputs.length + vis.outputs.length
      : Math.max(vis.inputs.length, vis.outputs.length)
  return HEADER_H + 8 + propCount * ROW_H + socketRows * ROW_H + extra
}

export function nodeWidth(node: NoodleBinNode): number {
  if (widgetId(null, node) === "reroute") return 16
  return Math.max(MIN_WIDTH, node.width)
}

export function bounds(tree: NoodleBinTree, catalog: Catalog | null): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of tree.nodes) {
    const p = blenderToCanvas(node.location_absolute)
    const w = nodeWidth(node)
    const h = estimatedHeight(node, catalog)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x + w)
    maxY = Math.max(maxY, p.y + h)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 400, height: 300 }
  return { x: minX - FIT_PAD, y: minY - FIT_PAD, width: maxX - minX + FIT_PAD * 2, height: maxY - minY + FIT_PAD * 2 }
}

export function handleId(side: "in" | "out", identifier: string): string {
  return `${side}:${identifier}`
}
