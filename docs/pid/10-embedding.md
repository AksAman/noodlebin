# PID — Embedding

Secondary. Build this after sharing. An embed draws a payload that already follows the interchange PID, using the same graph visualizer as the paste page. Embedding adds no node fields and never receives a private edit token.

## What an embed is

A read-only graph on someone else's page. The host page does not receive the viewer's clipboard unless the embed is configured to show Copy. The host page does not receive the edit token, the `.blend`, or the video. Those stay on the post.

Two mounts are supported.

### iframe

`/embed/:slug` renders the post's payload. The post must already exist. The frame is 100% of the host width and 480 pixels tall unless the host sets a height.

The frame shows the graph and a thin bar: tree type, Blender version, and a link labeled "Open in NodeVault" to `/p/:slug`. It does not show the upload form, the author grid, or edit controls.

Copy inside the frame is off unless the query `copy=1` is present. When it is on, the Copy button follows the copy-from-browser PID. The default is off so a blog embed does not write the clipboard on a casual click.

### Script mount

For a payload the host already has, with no post:

The host page includes `embed.js` from the NodeVault origin and calls `NodeVault.mount` with a CSS selector and a `source` string. `source` is the clipboard text (the `nodevault.tree` JSON) or an already parsed tree object.

`mount` validates with the same rules as the paste page and mounts `packages/node-view` into the element.

## Script options

| Option | Default | Meaning |
| --- | --- | --- |
| `source` | required | JSON text or parsed tree. |
| `catalogVersion` | taken from the payload | Tests override this. Production callers leave it unset. |
| `showCopy` | false | Draws the Copy button when true. |
| `height` | 480 | CSS pixels. |

`mount` returns an object with `unmount`. `unmount` removes the canvas and its listeners. A second `mount` on the same element unmounts the previous view first.

The script does not read the host page's cookies and does not post the payload to NodeVault's API. Catalog JSON loads from the NodeVault origin. When the host content-security policy blocks that fetch, `mount` draws the neutral fallback from the catalog PID and sets the element's `data-nodevault-catalog` attribute to `missing`.

## Sizing

The visualizer fits the graph once on mount, and again when the element width changes by more than 32 pixels. The host page scrolls the frame. Pan and zoom stay inside the frame.

## What an embed does not do

- It does not paste from the host page's clipboard on its own.
- It does not let the viewer edit the graph.
- It does not expose the edit token.
- It does not inline the `.blend`.

## Acceptance

- An iframe of a fixture post shows the same nodes and wires as the paste page for that payload, plus the Open in NodeVault link.
- `copy=1` on that iframe copies text that Blender's paste operator accepts.
- Without `copy=1`, the iframe has no Copy button.
- `NodeVault.mount` on a fixture draws the graph, and `unmount` leaves the element empty.
- A payload with a bad `format_version` shows the version error inside the element and does not mount a canvas.
