import type { Catalog } from "@noodlebin/catalog"
import type { NoodleBinNode, NoodleBinTree } from "@noodlebin/interchange"

export type NvKind = "generic" | "frame" | "reroute" | "group" | "zone" | "zone-bg"

export type NvNodeData = {
  payloadNode: NoodleBinNode
  tree: NoodleBinTree
  catalog: Catalog | null
  linkedInputs: Set<string>
  blenderVersion: string
  kind: NvKind
  zoneLabel?: string
  groupTree?: NoodleBinTree
}
