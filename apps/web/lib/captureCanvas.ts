function keepInShot(node: Node): boolean {
  if (!(node instanceof Element)) return true
  const name = node.classList
  return (
    !name.contains("react-flow__minimap") &&
    !name.contains("react-flow__controls") &&
    !name.contains("react-flow__attribution") &&
    !name.contains("react-flow__panel")
  )
}

/** Picture of the node editor currently on the paste page. */
export async function captureNodeCanvas(): Promise<File> {
  const root = document.querySelector("[data-node-canvas] .react-flow")
  if (!(root instanceof HTMLElement)) {
    throw new Error("The graph is not on screen, so there is nothing to use as a cover.")
  }
  const { toBlob } = await import("html-to-image")
  const blob = await toBlob(root, {
    cacheBust: true,
    pixelRatio: 1,
    backgroundColor: "#171717",
    filter: keepInShot,
  })
  if (!blob || blob.size === 0) throw new Error("Could not capture the graph.")
  return new File([blob], "canvas.png", { type: "image/png" })
}
