import { resolveCatalog, type CatalogIndex, type CatalogResolution } from "@/catalog"
import {
  canonicalJson,
  parseNoodleBinText,
  safeParseNoodleBinText,
  type NoodleBinError,
  type NoodleBinPayload,
} from "@/interchange"

export type IngestOk = {
  ok: true
  payload: NoodleBinPayload
  originalText: string
  catalog: CatalogResolution
}

export type IngestFail = {
  ok: false
  error: NoodleBinError
}

export function ingestText(text: string, catalogs: CatalogIndex): IngestOk | IngestFail {
  const parsed = safeParseNoodleBinText(text)
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
  return body.startsWith("{") && body.includes("noodlebin.tree")
}

export function treeTypeLabel(treeType: string): string {
  if (treeType === "ShaderNodeTree") return "Shader"
  if (treeType === "GeometryNodeTree") return "Geometry Nodes"
  if (treeType === "CompositorNodeTree") return "Compositor"
  return treeType
}

export function serializeCopy(payload: NoodleBinPayload): string {
  return canonicalJson(payload)
}

export function parseAttempt(text: string): ReturnType<typeof parseNoodleBinText> {
  return parseNoodleBinText(text)
}
