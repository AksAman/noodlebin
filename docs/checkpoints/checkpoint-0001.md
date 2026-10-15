# Checkpoint 0001 — Interchange format: envelope, validator, canonical serializer

- Date: 2026-10-15
- PID: docs/pid/05-interchange-format.md
- Status: ready for review

## Done

The `nodevault 1` payload can be parsed, validated, and written back in canonical form on both ends of the loop, and both ends produce identical bytes for the same object.

TypeScript, `packages/interchange` (`@nodevault/interchange`):

- `parseNodeVaultText(text)` reads the envelope, parses the JSON, validates, and returns the payload with unknown keys intact. `safeParseNodeVaultText` returns `{ ok, payload | error }` instead of throwing. `looksLikeNodeVault` is a cheap pre-check for paste handlers.
- `validatePayload(value)` enforces every rule in the PID's Validation section and throws `NodeVaultError` with a stable `code` (`bad_magic`, `bad_format_version`, `bad_tree_type`, `bad_root`, `dangling_link_socket`, ...) and a `path` such as `$.trees[0].links[2].to_socket.identifier`.
- `canonicalize`, `canonicalJson`, `canonicalText` reorder known keys into PID order, keep unknown keys after them in original order, leave `properties` and `widgets` in Blender's reported order, 2-space indent, trailing newline, magic line prepended.
- Full types for the payload in `src/types.ts`.

Python, `addon/serialize.py` and `addon/deserialize.py` (stdlib only, no `bpy`, no UI):

- `deserialize.parse_clipboard_text`, `split_envelope`, `looks_like_nodevault`, `validate_payload`, `NodeVaultError` with the same error codes as the TypeScript side.
- `serialize.canonicalize`, `canonical_json`, `canonical_text`, plus `format_number` and `dumps_pretty`, a `JSON.stringify(value, null, 2)`-compatible emitter so the add-on and the browser write identical bytes (JS number formatting: `5.0` → `5`, `1e21` → `1e+21`, `1e-7` → `1e-7`; JS string escaping).

Fixture: `fixtures/handwritten/worked-example-shader.nodevault.json` is the PID's worked example in canonical form. Both test suites assert that parse → canonical returns the file byte for byte.

Commands, from `v2/`:

- `bun install` once, then `bun test` (TypeScript) and `bun run typecheck`.
- `bun run test:py` or `python3 -m unittest discover -s addon/tests -t . -v` (Python).

## Files

- `package.json`, `tsconfig.base.json`, `.gitignore` — Bun workspace root (`packages/*`, `apps/*`), shared strict TS config.
- `packages/interchange/package.json`, `tsconfig.json` — the package; exports `./src/index.ts`.
- `packages/interchange/src/types.ts` — payload types and constants (`MAGIC`, `FORMAT`, `FORMAT_VERSION`, `TREE_TYPES`).
- `packages/interchange/src/errors.ts` — `NodeVaultError` and the error code union.
- `packages/interchange/src/envelope.ts` — magic-line handling and `parseNodeVaultText`.
- `packages/interchange/src/validate.ts` — the PID's validation rules.
- `packages/interchange/src/canonical.ts` — key orders and the canonical serializer.
- `packages/interchange/src/index.ts` — public surface.
- `packages/interchange/test/interchange.test.ts` — 35 tests.
- `addon/serialize.py` — canonical JSON, envelope writer, JS-compatible number and string formatting.
- `addon/deserialize.py` — envelope parser and validator; imports `.serialize` relatively as the add-on PID requires.
- `addon/tests/__init__.py`, `addon/tests/test_interchange.py` — 37 tests mirroring the TypeScript suite plus number-format cases.
- `fixtures/handwritten/worked-example-shader.nodevault.json` — hand-authored fixture from the PID.
- `docs/checkpoints/checkpoint-0001.md` — this file.

## Verified

- `bun test`: 35 pass, 0 fail (Bun 1.3.14, Node 20.19.3 present).
- `bun run typecheck`: clean under `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `python3 -m unittest discover -s addon/tests -t .`: 37 pass (Python 3.14.5).
- Cross-language byte check (throwaway script, not in the repo): a payload with every dict's keys reversed, unknown keys at payload, origin-warning, node, and socket level, floats `0.000001`, `1e21`, `-1.5e-7`, `5e-324`, `1.7976931348623157e308`, `1e16`, `0.30000000000000004`, and strings with `"`, `\`, newline, `\u0001`, `\u2028`, and non-ASCII was canonicalized by both implementations: 4378 bytes, `cmp` identical.
- `blender --background --factory-startup --python` smoke on Blender 5.1.0 (bundled Python 3.13.9): both modules import, the fixture round-trips byte for byte, `nodevault 2` raises `bad_magic`.
- Not run: nothing in this slice touches a window, a node tree, or the real clipboard. Those arrive with the copy and paste PIDs.

## Departures

- Added `packages/interchange/`. The PRD's repository sketch has no home for the TypeScript parser, validator, and canonical serializer; `packages/catalog` and `packages/node-view` are the wrong owners. `node-view` and `apps/web` will import this package.
- Tree key order: the PID's Trees schema block lists `nodes, links, interface`; the worked example lists `interface, nodes, links`. Implemented the worked example's order (`id, name, is_root, interface, nodes, links`). See Open.
- Integral floats serialize without a fraction in both languages (`140.0` → `140`, `-300.0` → `-300`). `JSON.stringify` cannot keep `.0`, and the PID says the browser copy must be byte-stable, so the Python side matches it rather than emitting `140.0`. Values are unchanged; only the spelling is. On paste, Blender receives a Python `int` for those values; `bpy` accepts `int` for float RNA properties. The paste PID's tests will confirm this on real nodes.
- The Python parser also accepts bare JSON with `format: nodevault.tree` and no magic line. The paste-in-browser PID specifies that only for the browser; applying it in the add-on is harmless and keeps the two parsers identical.
- `addon/tests/` lives inside the extension directory so the relative import `from .serialize import ...` is exercised the way Blender will run it. The manifest in the add-on PID must exclude `tests/` with `paths_exclude_pattern`.
- The fixture is hand-authored from the PID's worked example, not captured from Blender, hence the `fixtures/handwritten/` folder. Captured fixtures from the add-on will sit beside it.

## Next

Node catalog (`docs/pid/06-node-catalog.md`), first slice: `scripts/extract_node_catalog.py` run headless against the installed Blender, producing `catalog/versions/<version>/catalog.json` with themes, socket colors, categories, node records, the socket-layout probe, and zone detection. The loader (`packages/catalog`) is the slice after that.

## Open

- Tree key order: confirm `interface, nodes, links` (worked example) over `nodes, links, interface` (schema block), or the reverse. One line in the PID should change either way so the two agree.
- Resolved in review: `blender_version_min` is `5.0.0` (any Blender 5.x). The add-on PID was updated. Catalog extraction and Blender-side testing run on the installed 5.1.0.
- Nothing is committed. The working tree holds the first commit (`feat: add prds`) plus everything above. Say if you want each checkpoint committed as it lands.
