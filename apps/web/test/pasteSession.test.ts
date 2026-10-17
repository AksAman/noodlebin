import { describe, expect, test } from "bun:test"
import { clearPasteSession, PASTE_SESSION_KEY, pasteBootScript, readPasteSession, writePasteSession } from "@/lib/pasteSession"
import { SHARE_DRAFT_KEY } from "@/lib/shareDraft"

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}

describe("paste session", () => {
  test("saves a paste and replaces it on the next write", () => {
    const storage = memoryStorage()
    expect(readPasteSession(storage)).toBeNull()

    writePasteSession(storage, "{\"tree\":1}")
    expect(storage.getItem(PASTE_SESSION_KEY)).toBe("{\"tree\":1}")
    expect(readPasteSession(storage)).toBe("{\"tree\":1}")

    writePasteSession(storage, "{\"tree\":2}")
    expect(readPasteSession(storage)).toBe("{\"tree\":2}")
    expect(storage.getItem(PASTE_SESSION_KEY)).toBe("{\"tree\":2}")
  })

  test("boot script hides the empty prompt only when a paste or share draft is stored", () => {
    const run = new Function("sessionStorage", "document", pasteBootScript)
    const attrs = new Map<string, string>()
    const document = { documentElement: { setAttribute: (key: string, value: string) => attrs.set(key, value) } }

    run(memoryStorage(), document)
    expect(attrs.has("data-paste-restoring")).toBe(false)

    const withPaste = memoryStorage()
    withPaste.setItem(PASTE_SESSION_KEY, "{\"tree\":1}")
    run(withPaste, document)
    expect(attrs.get("data-paste-restoring")).toBe("")

    attrs.clear()
    const withDraft = memoryStorage()
    withDraft.setItem(SHARE_DRAFT_KEY, "{\"treeText\":\"{}\"}")
    run(withDraft, document)
    expect(attrs.get("data-paste-restoring")).toBe("")
  })

  test("clear removes the saved paste", () => {
    const storage = memoryStorage()
    writePasteSession(storage, "{\"tree\":1}")
    clearPasteSession(storage)
    expect(readPasteSession(storage)).toBeNull()
  })
})
