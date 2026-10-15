# NodeVault — Master PID

This is the master product document. Feature detail lives in the PIDs under [`pid/`](pid/). An implementer reads the newest file in [`checkpoints/`](checkpoints/) first, then this file, then the primary PIDs in order. Sharing and embedding are specified, and they are not the first thing to build.

After every major or minor feature, the implementer stops, writes a checkpoint, and waits for review. The rule is in [Checkpoints](#checkpoints). Do not start the next feature in the same turn.

## Product

NodeVault copies a Blender node selection to the clipboard and pastes it into a browser, where the graph is drawn. The same clipboard payload pastes back into Blender and recreates the nodes.

That round trip is the product. A person can do it with no account and no upload: copy in Blender, paste in the browser, copy in the browser, paste in Blender.

Two later products sit on the same payload:

- **Sharing.** A public link, a cover, a video, a `.blend` download, an author page.
- **Embedding.** The same graph rendered inside someone else's page.

## Documents

| Order | PID | What it decides |
| --- | --- | --- |
| 1 | [Interchange format](pid/05-interchange-format.md) | The clipboard payload. Every other PID uses this schema. |
| 2 | [Node catalog](pid/06-node-catalog.md) | How a Blender version becomes a JSON registry the browser uses to draw nodes, and how a new Blender release is absorbed. |
| 3 | [Copy from Blender](pid/01-copy-from-blender.md) | Selection to clipboard. |
| 4 | [Paste in the browser](pid/02-paste-in-browser.md) | Clipboard to an on-screen graph. |
| 5 | [Graph visualizer](pid/07-graph-visualizer.md) | How each node, socket, wire, frame, group, and widget is drawn. |
| 6 | [Copy from the browser](pid/03-copy-from-browser.md) | Graph back to clipboard. |
| 7 | [Paste in Blender](pid/04-paste-in-blender.md) | Clipboard back to live nodes. |
| 8 | [Add-on](pid/08-addon.md) | Install, keymap, panel, and operator wiring for the two Blender directions. |
| — | [Sharing](pid/09-sharing.md) | Secondary. Public posts, media, author pages, share cards. |
| — | [Embedding](pid/10-embedding.md) | Secondary. Rendering a payload inside another site. |

When two documents disagree, the interchange format wins on data shape, and this master wins on priority. A checkpoint records what was built. It does not overrule this file or a PID. If the work had to depart from a PID, the checkpoint says so and the PID is updated only after review.

## Checkpoints

The implementer pauses after each major or minor feature. A feature is one PID's worth of work, or one coherent slice of a PID when that PID is too large for a single sitting (the catalog extractor is one slice, the catalog loader is another). Pasting a two-node fixture end to end is a feature. A drive-by refactor is not.

The pause has three parts:

1. Write `v2/docs/checkpoints/checkpoint-NNNN.md`. `NNNN` is the next four-digit number. `checkpoint-0001.md` is the first. Never overwrite an older checkpoint.
2. Stop. The message to the reviewer names the checkpoint path, the feature just finished, and the feature that would be next.
3. Wait. The next feature starts only after the reviewer replies. A new agent, or the same agent after a fresh session, reads the highest-numbered checkpoint before writing code.

Each checkpoint uses this outline:

```markdown
# Checkpoint NNNN — <feature name>

- Date:
- PID: <path of the PID this slice implements>
- Status: ready for review

## Done

What works now, in behavior a person can try. Name the commands, routes, and shortcuts.

## Files

Paths added or changed, one line each on why.

## Verified

What was actually run (Blender version, browser, tests) and what passed. If something could not be run, say that in one line.

## Departures

Anything that differs from the PID. If there are none, write "None."

## Next

The single feature to build after review, and the PID it comes from.

## Open

Questions for the reviewer. If there are none, write "None."
```

The checkpoint is the handoff. It carries the state that would otherwise live only in a chat: what is finished, what was skipped, and what the next agent should open first.

## Users

A Blender artist who builds shader, geometry, or compositor nodes and wants another person to see that exact graph and drop it into their own file.

The first session looks like this:

1. In Blender, select the nodes and run NodeVault: Copy.
2. Open the NodeVault page and paste.
3. The graph appears, laid out as it was in Blender.
4. Copy from that page.
5. In another Blender file, focus the matching node editor and run NodeVault: Paste.
6. The nodes, values, and links are back.

## Priority

Build and accept the core loop before any sharing or embedding work.

The core loop is done when all of these pass on one Blender version, for a shader tree and a geometry-node tree:

- A selection that includes a frame, a reroute, a muted node, a color ramp or float curve, and a nested node group copies to the clipboard.
- Pasting that clipboard into the browser draws those nodes with catalog colors, socket rows, the ramp or curve, the frame's children, and the wires.
- Opening the group in the browser shows the inner tree.
- Copy on that page returns a payload the add-on accepts.
- Pasting into an empty tree of the same type recreates the graph: node types, labels, values, links, frame parenting, mute state, and the group.
- Pasting a shader payload into a geometry-node editor is refused, with a message that names both tree types.
- Running the catalog extractor on that Blender version is the only step required for a newly added built-in node to draw in the browser through the generic view.

Sharing and embedding are done later, against the same payload, without changing the clipboard format.

## Surfaces

```text
Blender add-on                         Browser
┌─────────────────────┐               ┌──────────────────────────┐
│ Copy selection      │  clipboard    │ Paste target             │
│        │            │ ───────────▶  │        │                 │
│        ▼            │  nodevault 1    │        ▼                 │
│ nodevault.tree JSON   │  + JSON       │ Graph visualizer         │
│                     │ ◀───────────  │        │                 │
│ Paste into editor   │  same payload │ Copy button              │
└─────────────────────┘               └──────────────────────────┘
                                              │
                                              │ same component, later
                                              ▼
                                      Share page / embed
```

The add-on talks to the system clipboard. The browser talks to the system clipboard. A server is not on the path of the core loop.

## Decisions

These are settled. Feature PIDs implement them.

- The clipboard is the interchange. The first line is the ASCII magic `nodevault 1`. The remainder is UTF-8 JSON, `format` equal to `nodevault.tree`, `format_version` equal to `1`.
- The payload is self-sufficient for a same-version round trip. Paste in Blender creates each node fresh and applies the stored sockets, properties, and widgets. It does not need the catalog for that.
- The catalog is the drawing registry and the cross-version guide. The browser joins the payload to the catalog for that `blender_version` to get header colors, socket colors, category, and the full socket list of a node at its default mode. Properties that change the socket layout are always stored on the instance.
- Supported editors are shader (`ShaderNodeTree`), geometry nodes (`GeometryNodeTree`), and compositor (`CompositorNodeTree`).
- Blender's own node Ctrl/Cmd+C and Ctrl/Cmd+V stay untouched. As of the 5.2 manual, that copy writes a partial `.blend` to Blender's on-disk copy buffer and another Blender on the same machine can paste it. It does not put text on the system clipboard, so a browser still cannot draw it. NodeVault's shortcut writes `nodevault 1` text to the system clipboard, which is the only payload the browser reads. Details are in the copy-from-Blender PID.
- The add-on is a current extension: `blender_manifest.toml`, no `bl_info`, relative imports, preferences keyed by `__package__`. Built with `blender --command extension build`. The add-on PID has the manifest.
- The browser graph is read-only in the core product. Copy returns the payload that was pasted, byte for byte after a canonical parse-and-serialize that preserves every field. The page does not invent a second dialect.
- Browser layout uses each node's absolute Blender position with Y flipped. Blender paste uses parent-relative positions and drops the graph so its center sits on the node cursor.
- Groups are real node trees inside the payload, not flattened nodes. The browser can open a group. Blender paste recreates the group data-blocks first.
- On a new Blender release, one headless command writes `catalog/versions/<version>/catalog.json`. Ordinary new nodes render without a code change. The command and the registry rules are in the catalog PID.
- The site does not run Blender and does not execute anything inside a `.blend`. That constraint belongs to sharing and stays there.
- Theme colors and the static HTML mock in `prior_projects/nodevault-visualizer` are a look reference. The old add-on is not the implementation. It targets Blender 2.92 and serializes the wrong object.

## Repository the core implies

```text
v2/
  docs/prd.md                         this file
  docs/pid/                           feature PIDs
  docs/checkpoints/checkpoint-NNNN.md handoff after each feature; newest wins
  catalog/versions/<version>/catalog.json
  scripts/extract_node_catalog.py
  addon/                              Blender extension
  packages/catalog/                   loader and types
  packages/node-view/                 graph visualizer
  apps/web/                           paste page; later, sharing and embed
  fixtures/                           captured payloads used as tests
```

`packages/node-view` has no knowledge of accounts, uploads, or embeds. It takes a parsed tree and a catalog and draws. The paste page, the future post page, and the future embed all mount that component.

## Out of the core

Specified so they are not forgotten, and sequenced so they do not block the loop:

- Accounts, likes, comments, and editing the graph in the browser.
- Vault sync from the add-on. Copy stays local. Sync to vault uploads the graph after login, and Open shows the page where the author adds a cover and a video. See the sharing PID.
- Video, cover images, author pages, and Open Graph cards. See the sharing PID.
- iframe and script embeds. See the embedding PID.
- Server-side rendering of a `.blend`.
- Texture-node and geometry-node-tool trees beyond the three editors above. The extractor may record them later. The core UI does not promise them.

## Prior projects

`prior_projects/NodeBinBlenderAddon` and `prior_projects/nodevault-visualizer` stay as reference. Take the playground's spacing, colors, and socket rows as the visual target. Take `bpy_colors.json` as an example of the catalog `themes` object. Leave the 2.92 serializer, the object named `Serializer`, and the sample React Flow node types (`dataNode`, `sourceNode`, `functionNode`, `valueNode`) behind.
