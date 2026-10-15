import type { Catalog } from "@nodevault/catalog"
import type { NodeVaultNode, NodeVaultTree } from "@nodevault/interchange"

export type NvKind = "generic" | "frame" | "reroute" | "group" | "zone" | "zone-bg"

export type NvNodeData = {
  payloadNode: NodeVaultNode
  tree: NodeVaultTree
  catalog: Catalog | null
  linkedInputs: Set<string>
  blenderVersion: string
  kind: NvKind
  zoneLabel?: string
  groupTree?: NodeVaultTree
}
