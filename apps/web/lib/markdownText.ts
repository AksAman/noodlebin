import markdownToTxt from "markdown-to-txt"

/** Plain text for link previews and search snippets. The stored note stays markdown. */
export function markdownPlain(source: string): string {
  return markdownToTxt(source).replace(/\s+/g, " ").trim()
}
