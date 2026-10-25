# PID — Paste in the browser

Primary. This is the middle of the core loop: the clipboard becomes a graph on a page. Drawing rules live in the graph visualizer PID. The payload lives in the interchange PID.

## The page

The first web surface is a single route, `/`. It has two states.

**Empty.** A large paste target fills the viewport. The text reads: "Copy nodes in Blender with noodlebin, then paste here." A secondary control opens a `.noodlebin.json` file. There is no account form, no upload progress, and no gallery on this route.

**Filled.** The graph visualizer occupies the viewport. A bar across the top shows:

- Tree type, in words: Shader, Geometry Nodes, or Compositor.
- `blender_version_string`.
- Node count from `origin.node_count`, and the group count when `trees.length > 1`.
- A Copy button, specified in the copy-from-browser PID.
- A Clear control that returns to the empty state and drops the in-memory payload.

The page title is `noodlebin`.

Nothing is sent to a server when the user pastes. The payload stays in memory. Refreshing the page returns to the empty state. Persistence, links, and accounts are the sharing PID.

## How paste is detected

Listen for the `paste` event on the document while this route is mounted.

1. Read `event.clipboardData.getData("text/plain")`.
2. If the trimmed text starts with `{` and contains `noodlebin.tree`, parse it as JSON and validate it with the interchange PID's rules.
3. If that text fails to parse, show the broken-JSON error from the parser rather than the not-a-node-tree message.
4. Any other clipboard text, while the paste target or the canvas is focused, shows "Clipboard is not a noodlebin node tree." A paste whose event target is an input or textarea is left to the browser.

Dropping a `.noodlebin.json` or `.json` file on the page uses the same parser.

On success, prevent the browser's default paste.

## Parser

Use the validation rules in the interchange PID. On failure, keep the current graph if one is showing, and show the error inline. On failure from the empty state, stay empty and show the error inside the paste target.

On success:

1. Hold the original text and the parsed object.
2. Load the catalog for `blender_version` from `catalog/versions` shipped with the app. The loader's fallback rules are in the catalog PID.
3. Mount the graph visualizer with the parsed tree, the catalog, and `readOnly: true`.
4. Fit the view to the root tree.

Opening a group does not change the stored payload. The Copy button always copies the whole payload, including groups that are not on screen.

## Catalog missing or partial

The graph still mounts. Nodes without a catalog entry use the generic fallback from the catalog PID. A dismissible line in the top bar says which Blender version was requested and which catalog was used, or that no catalog was used.

## Large payloads

A payload whose text exceeds 2 MB still parses. The first visualizer does not virtualize nodes. A geometry-node fixture of at least 200 nodes, produced by the add-on and stored in `fixtures/`, must become visible and accept pan and zoom. If the main thread blocks for more than two seconds on that fixture, that is a bug to fix in the visualizer, not a reason to reject the paste.

## Keyboard

- Ctrl/Cmd+V pastes, including when a graph is already showing. A new valid payload replaces the current one.
- Ctrl/Cmd+C is owned by the copy-from-browser PID when the graph is focused and no text is selected.
- Escape from an open group returns to the parent tree. Escape on the root does nothing.

## What this page does not do

- It does not edit node values.
- It does not upload the tree.
- It does not fetch a URL. Loading a shared post is the sharing PID, and that page mounts the same visualizer.
- It does not run Python or Blender.

## Acceptance

- Pasting a real copy of two linked nodes draws both nodes and one wire.
- Pasting ordinary text shows the not-a-node-tree message and no partial graph.
- Pasting a payload with `format_version` 99 shows a version error and no partial graph.
- A second valid paste replaces the graph and does not stack two canvases.
- The network log shows no request whose body is the payload.
