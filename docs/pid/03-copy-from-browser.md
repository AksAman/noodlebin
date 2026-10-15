# PID — Copy from the browser

Primary. The graph on screen goes back to the clipboard as a NodeVault payload Blender can paste. This is the reverse direction of paste-in-the-browser.

## When it is available

The Copy control is visible whenever a valid payload is loaded on the paste page, on a future post page, or inside an embed that was configured to allow copy. The paste page always allows copy. The embed default is in the embedding PID.

The control is a button labeled Copy in the top bar, and the shortcut Ctrl/Cmd+C while the graph is focused and the user has not selected text.

## What gets copied

The full payload for the tree that was pasted or loaded. That includes group trees that are not currently displayed, `origin.warnings`, and unknown JSON keys the canonical serializer is required to preserve.

Copy does not export a screenshot. It does not export the inner group the user happens to be viewing. It does not export a highlighted subset. A later control can add "copy this group." The core button copies the whole tree so Blender recreates the original selection.

## Procedure

1. Run the canonical serializer from the interchange PID on the in-memory object.
2. Write that string with `navigator.clipboard.writeText`. Nothing is prefixed.
3. If that rejects because the document is unfocused, retry once on the next click of the Copy button, which is a user gesture. If the write still fails, show a readonly text area with the payload selected and the sentence "Copy this text, then paste it in Blender."
4. On success the button label becomes "Copied" for two seconds, then returns to "Copy".

The canonical form may differ in whitespace from the text the user originally pasted. It must not differ in data. The test parses the original and the copy, walks every value, and asserts equality. Key order is ignored for that comparison and enforced for the serialized output.

## Highlighting

The visualizer may highlight a node under the pointer so a socket name is easier to read. That highlight does not change what Copy writes.

## Acceptance

- After a browser paste, Copy produces text the Blender add-on parses without a validation error.
- Pasting that text in Blender recreates the same `bl_idname` set, the same link identifiers, and the same ramp stops as the original Blender copy.
- Copy while a group is open still includes the root tree and the group tree.
- An unknown key injected into a fixture is still present after parse and Copy.
- The Copied confirmation appears and the label resets.
