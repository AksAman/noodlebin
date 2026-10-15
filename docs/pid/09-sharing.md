# PID — Sharing

Secondary. Build this after the core loop in the master PID is accepted. Sharing publishes a payload that already exists and adds a page, media, and an author. It does not define a second node format.

## What a visitor can do

- Open a link and see the graph visualizer on that payload.
- Copy the payload from that page with the same Copy control as the paste page.
- Watch an optional video and see a required cover image.
- Download an optional `.blend`.
- Open the author's grid of covers.

Paste in Blender from a link fetches the payload text, validates it, and runs the paste operator. The rebuild rules stay in the paste-in-Blender PID.

## Post fields

These sit beside the payload. None of them are written into `nodebin.tree`.

| Field | Required | Notes |
| --- | --- | --- |
| `slug` | yes | Public path `/p/:slug`. |
| `title` | yes | |
| `author_name`, `author_slug` | yes | Author path `/@author_slug`. |
| `tree` | no | The `nodebin.tree` object. Null when the post was created without a payload. The page then shows the cover and a line that the graph appears when a payload is attached. |
| `blender_version_string` | yes | Taken from the payload when one is present. Typed by the user otherwise. |
| `tree_type` | yes | The same three values as the payload. |
| `cover_url` | public posts | Still image and video poster. A vault draft synced from the add-on may omit it. The public grid and the share card require it. |
| `video_url` | no | `video/mp4` only. |
| `blend_url` | no | Stored and downloaded. The server never opens it. |
| `description` | no | |
| `nodevember_day` | no | Integer 1 through 30. |
| `card_url` | public posts | 1200 by 630 share image. Absent on a draft that has no cover. |
| `edit_token_hash` | yes | The raw token is returned once at creation. |

Caps: cover 10 MB, video 50 MB, blend 100 MB, payload 5 MB. Other video types are rejected. This version does not transcode.

## Pages

**Post `/p/:slug`.** Cover or video first, then title, author, tree type, Blender version, and day. Then Copy, download blend when present, and the description. Then the graph visualizer when `tree` is present.

**Home.** While the core is the only product, `/` is the paste page. When sharing ships, the paste target moves to `/paste` and `/` becomes a grid of covers, newest first, filterable by tree type and author name. That move is sharing work.

**Author `/@author_slug`.** The same grid for one name.

**Web upload.** Title, author, tree type, Blender version, cover, optional video, optional blend, optional `.nodebin.json`. The response is the public URL and the edit token. A later request with that token can attach a payload from the add-on.

## Share card

Generated when the post is created and stored as `card_url`. The image is 1200 by 630. The cover fills the frame. A dark bar along the bottom holds the title, `@author`, the tree type, and the word Nodebin. The post's Open Graph and Twitter tags point at that image.

## Add-on: login, sync, open

These operators ship with sharing, not with the core extension. The manifest then adds:

```toml
network = "Sync node trees to your Nodebin vault"
```

Every request checks `bpy.app.online_access` first. When it is false, the operator reports that System preferences have Allow Online Access turned off, and it does not open a socket. When `bpy.app.online_access_overridden` is set, the report says this Blender was started with offline mode and the preference cannot be changed.

The author logs in once from the add-on preferences. The button opens the system browser to a device-login page and shows a short code in the preferences. The add-on polls until the login finishes or the user cancels. The token is stored in the extension's user directory from `bpy.utils.extension_path_user`, not in the `.blend` and not in the extension package. Later Blender sessions on that machine are already logged in.

The N-panel then has two extra buttons beside Copy and Paste.

**Sync to vault.** Runs the same capture as Copy, including `bpy.ops.node.clipboard_copy()`. Uploads the `nodebin.tree` JSON to the logged-in account. If the running Blender's node copy-buffer path can be resolved, the `.blend` fragment is uploaded with it and stored as `blend_url`. No screenshot and no video are captured in Blender. The item is a vault draft: `cover_url` may be null, and `card_url` is absent until a cover exists. Sync of a selection that was already synced updates that draft instead of creating a second one. The match key is stored in the extension user directory, keyed by a hash of the blend filepath plus the node-tree name, and is replaced when Sync runs again on that tree.

**Open.** Syncs if this tree has no draft yet, then opens the draft's page in the system browser. That page is where the author adds a cover, a video, and a description, and marks the draft public. The share card is generated at that moment, from the cover, using the rules above.

A draft is listed in the author's vault and is absent from the public home grid. Public posts still require a cover.

`nodebin.paste_link` takes a `/p/:slug` URL, fetches the payload, and runs the paste operator. When the post has a `blend_url` produced from Blender's copy buffer and `blender_version` equals the running version, paste writes that file to the node copy-buffer path and calls `bpy.ops.node.clipboard_paste` instead of the JSON builder. Any other blend, or a version mismatch, uses the JSON paste from the paste-in-Blender PID and reports that Blender's own paste was not used.

## API

- `POST /api/posts` as multipart. Response is `{ url, edit_token }`.
- `GET /api/posts/:slug` returns the public post and omits the edit token.
- `PATCH /api/posts/:slug` requires the edit token. Used to attach a payload or replace media.
- `GET /api/posts?author=&tree_type=` fills the grids.
- `GET /p/:slug/opengraph-image` serves the stored card.

## Safety

The server stores bytes. It does not launch Blender, import the blend, or evaluate Python that a blend might contain. A download is a file response with the original filename.

## Acceptance

- A published payload draws in the graph visualizer with the same fixture rules as the paste page.
- Copy on the post page pastes back into Blender.
- A social-card preview of the post URL shows the 1200 by 630 image with the title and author.
- A web upload without a payload still has a cover, a card, and an author grid entry.
- Paste-from-link uses the paste operator's report when a node type is unknown.
