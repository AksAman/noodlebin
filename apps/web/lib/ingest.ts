import { resolveCatalog, type CatalogIndex, type CatalogResolution } from "@/catalog"
import {
  canonicalJson,
  parseNodeVaultText,
  safeParseNodeVaultText,
  type NodeVaultError,
  type NodeVaultPayload,
} from "@/interchange"

export type IngestOk = {
  ok: true
  payload: NodeVaultPayload
  originalText: string
  catalog: CatalogResolution
}

export type IngestFail = {
  ok: false
  error: NodeVaultError
}

export function ingestText(text: string, catalogs: CatalogIndex): IngestOk | IngestFail {
  const parsed = safeParseNodeVaultText(text)
  if (!parsed.ok) return parsed
  return {
    ok: true,
    payload: parsed.payload,
    originalText: text,
    catalog: resolveCatalog(catalogs, parsed.payload.blender_version),
  }
}

export function looksLikeAttempt(text: string): boolean {
  const body = text.replace(/^\uFEFF/, "").trim()
  return body.startsWith("{") && body.includes("nodevault.tree")
}

export function treeTypeLabel(treeType: string): string {
  if (treeType === "ShaderNodeTree") return "Shader"
  if (treeType === "GeometryNodeTree") return "Geometry Nodes"
  if (treeType === "CompositorNodeTree") return "Compositor"
  return treeType
}

export function serializeCopy(payload: NodeVaultPayload): string {
  return canonicalJson(payload)
}

export function parseAttempt(text: string): ReturnType<typeof parseNodeVaultText> {
  return parseNodeVaultText(text)
}
