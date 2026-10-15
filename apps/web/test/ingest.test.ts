import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadCatalogDirectory } from "@/catalog/load"
import { parseNodeVaultText } from "@/interchange"
import { ingestText, serializeCopy } from "@/lib/ingest"

const root = join(import.meta.dir, "../../..")
const fixturePath = join(root, "fixtures/handwritten/worked-example-shader.nodevault.json")

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(rec).sort()) out[key] = sortJson(rec[key])
    return out
  }
  return value
}

describe("ingestText", () => {
  test("loads the two-node fixture and a catalog", async () => {
    const catalogs = await loadCatalogDirectory(join(root, "catalog/versions"))
    const text = readFileSync(fixturePath, "utf8")
    const result = ingestText(text, catalogs)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.trees[0]?.nodes).toHaveLength(2)
    const ramp = ingestText(
      readFileSync(join(root, "fixtures/handwritten/three-stop-ramp.nodevault.json"), "utf8"),
      catalogs,
    )
    expect(ramp.ok).toBe(true)
    if (!ramp.ok) return
    expect(ramp.catalog.match).toBe("exact")
    expect(ramp.catalog.catalog?.blender_version_string).toBe("5.1.0")
  })

  test("ordinary text is not a node tree", async () => {
    const catalogs = await loadCatalogDirectory(join(root, "catalog/versions"))
    const result = ingestText("hello", catalogs)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("not_nodevault")
    expect(result.error.message).toContain("not a NodeVault node tree")
  })

  test("format_version 99 is a version error", async () => {
    const catalogs = await loadCatalogDirectory(join(root, "catalog/versions"))
    const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>
    raw["format_version"] = 99
    const result = ingestText(JSON.stringify(raw), catalogs)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("bad_format_version")
  })

  test("broken JSON that looks like a payload reports bad_json", async () => {
    const catalogs = await loadCatalogDirectory(join(root, "catalog/versions"))
    const result = ingestText('{ "format": "nodevault.tree", ', catalogs)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("bad_json")
  })

  test("Copy serializes the same data, including an unknown key", async () => {
    const catalogs = await loadCatalogDirectory(join(root, "catalog/versions"))
    const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>
    raw["extra_note"] = "keep-me"
    const result = ingestText(JSON.stringify(raw), catalogs)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const copy = serializeCopy(result.payload)
    expect(copy).toContain('"extra_note"')
    const again = parseNodeVaultText(copy)
    expect(sortJson(again)).toEqual(sortJson(result.payload))
  })
})
