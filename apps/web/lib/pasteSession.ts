import { SHARE_DRAFT_KEY } from "@/lib/shareDraft"

export const PASTE_SESSION_KEY = "nodevault.paste"

/** Runs in <head> before first paint, same idea as the theme boot script. */
export const pasteBootScript = `try{var p=sessionStorage.getItem(${JSON.stringify(PASTE_SESSION_KEY)});var d=sessionStorage.getItem(${JSON.stringify(SHARE_DRAFT_KEY)});if((p&&p.trim())||(d&&d.trim()))document.documentElement.setAttribute("data-paste-restoring","")}catch(e){}`

export function clearPasteRestoring(root: Pick<HTMLElement, "removeAttribute"> = document.documentElement): void {
  root.removeAttribute("data-paste-restoring")
}

type PasteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function readPasteSession(storage: PasteStorage): string | null {
  try {
    const raw = storage.getItem(PASTE_SESSION_KEY)
    if (!raw?.trim()) return null
    return raw
  } catch {
    return null
  }
}

export function writePasteSession(storage: PasteStorage, text: string): void {
  try {
    storage.setItem(PASTE_SESSION_KEY, text)
  } catch {
    // Session storage can be unavailable or over quota. The paste still lives in memory.
  }
}

export function clearPasteSession(storage: PasteStorage): void {
  try {
    storage.removeItem(PASTE_SESSION_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}
