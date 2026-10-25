# noodlebin

Copy Blender node trees to the browser and paste them back.

**[noodlebin.art](https://www.noodlebin.art)** · [Get the Blender add-on](https://extensions.blender.org/add-ons/noodlebin/)

---

## What it does

Select nodes in any Blender node editor, press **Ctrl/Cmd + Shift + C**, and paste them on [noodlebin.art](https://www.noodlebin.art). The graph is drawn in the browser. Share the link. Hit **Copy for Blender** on any graph on the site, press **Ctrl/Cmd + Shift + V** in Blender, and the nodes are back — values, links, frames, and groups intact.

Works with Shader, Geometry Nodes, and Compositor trees. Blender 5.0+.

## Repo structure

```
addon/          Blender extension (Python, GPL-3.0)
apps/web/       Next.js web app (AGPL-3.0)
packages/
  interchange/  Wire format parser and validator (AGPL-3.0)
  catalog/      Node catalog resolver (AGPL-3.0)
  node-view/    React graph renderer (AGPL-3.0)
fixtures/       Handwritten .noodlebin.json test fixtures
docs/           Product and interchange format docs
```

## Quickstart

```bash
# Install dependencies
make install

# Start the web app (needs a Postgres container)
make db-up
make dev

# Build the Blender extension
make addon          # → dist/noodlebin-0.1.0.zip
```

## Development

```bash
make test           # JS/TS tests
make test-py        # Python tests (add-on + scripts)
make typecheck      # TypeScript across all packages
```

Requires [Bun](https://bun.sh), [uv](https://docs.astral.sh/uv/), and [Docker](https://www.docker.com) for local dev. Blender 5.x is needed to build the extension zip.

## Interchange format

Node trees are serialized as `noodlebin.tree` JSON — plain text, schema-validated, deterministic key order. The format is documented in [`docs/pid/05-interchange-format.md`](docs/pid/05-interchange-format.md). The parser lives in `packages/interchange/` (TypeScript) and `addon/deserialize.py` (Python).

## License

- **Blender add-on** (`addon/`): [GPL-3.0-or-later](addon/LICENSE) — required by Blender's license.
- **Everything else**: [AGPL-3.0-or-later](LICENSE).
