# Checkpoint 0001 — Interchange format: parser, validator, canonical serializer

- Date: 2026-10-15
- PID: docs/pid/05-interchange-format.md
- Status: reviewed; amended after review (see Review changes)

## Done

The `nodevault.tree` payload can be parsed, validated, and written back in canonical form on both ends of the loop, and both ends produce identical bytes for the same object. The clipboard text is one plain JSON object; the same bytes are a valid `.nodevault.json` file.

TypeScript, `packages/interchange` (`@nodevault/interchange`):

- `parseNodeVaultText(text)` recognizes the text, parses the JSON, validates, and returns the payload with unknown keys intact. `safeParseNodeVaultText` returns `{ ok, payload | error }` instead of throwing. `looksLikeNodeVault` is a cheap pre-check for paste handlers.
- `validatePayload(value)` enforces every rule in the PID's Validation section and throws `NodeVaultError` with a stable `code` (`not_nodevault`, `bad_json`, `bad_format_version`, `bad_tree_type`, `bad_root`, `dangling_link_socket`, ...) and a `path` such as `$.trees[0].links[2].to_socket.identifier`.
- `canonicalize` and `canonicalJson` reorder known keys into PID order, keep unknown keys after them in original order, leave `properties` and `widgets` in Blender's reported order, 2-space indent, trailing newline. `canonicalJson` is the clipboard text and the file content.
- Full types for the payload in `src/types.ts`.

Python, `addon/serialize.py` and `addon/deserialize.py` (stdlib only, no `bpy`, no UI):

- `deserialize.parse_clipboard_text`, `looks_like_nodevault`, `validate_payload`, `NodeVaultError` with the same error codes as the TypeScript side.
- `serialize.canonicalize`, `canonical_json`, plus `format_number` and `dumps_pretty`, a `JSON.stringify(value, null, 2)`-compatible emitter so the add-on and the browser write identical bytes (JS number formatting: `5.0` → `5`, `1e21` → `1e+21`, `1e-7` → `1e-7`; JS string escaping).

Fixture: `fixtures/handwritten/worked-example-shader.nodevault.json` is the PID's worked example in canonical form. Both test suites assert that parse → canonical returns the file byte for byte, and that `JSON.parse` / `json.loads` accept the file on their own.

Commands, from `v2/`:

- `bun install` once, then `bun test` (TypeScript) and `bun run typecheck`.
- `bun run test:py` or `python3 -m unittest discover -s addon/tests -t . -v` (Python).

## Files

- `package.json`, `tsconfig.base.json`, `.gitignore` — Bun workspace root (`packages/*`, `apps/*`), shared strict TS config.
- `packages/interchange/package.json`, `tsconfig.json` — the package; exports `./src/index.ts`.
- `packages/interchange/src/types.ts` — payload types and constants (`FORMAT`, `FORMAT_VERSION`, `TREE_TYPES`).
- `packages/interchange/src/errors.ts` — `NodeVaultError` and the error code union.
- `packages/interchange/src/parse.ts` — text recognition and `parseNodeVaultText`.
- `packages/interchange/src/validate.ts` — the PID's validation rules.
- `packages/interchange/src/canonical.ts` — key orders and the canonical serializer.
- `packages/interchange/src/index.ts` — public surface.
- `packages/interchange/test/interchange.test.ts` — 34 tests.
- `addon/serialize.py` — canonical JSON, JS-compatible number and string formatting.
- `addon/deserialize.py` — text parser and validator; imports `.serialize` relatively as the add-on PID requires.
- `addon/tests/__init__.py`, `addon/tests/test_interchange.py` — 36 tests mirroring the TypeScript suite plus number-format cases.
- `fixtures/handwritten/worked-example-shader.nodevault.json` — hand-authored fixture from the PID.
- `docs/checkpoints/checkpoint-0001.md` — this file.

## Verified

After the review changes:

- `bun test`: 34 pass, 0 fail (Bun 1.3.14, Node 20.19.3 present).
- `bun run typecheck`: clean under `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `python3 -m unittest discover -s addon/tests -t .`: 36 pass (Python 3.14.5).
- Cross-language byte check (throwaway script, not in the repo): a payload with every dict's keys reversed, unknown keys at payload, node, and socket level, floats `0.000001`, `1e21`, `-1.5e-7`, `5e-324`, `1e16`, and strings with `"`, `\`, newline, `\u0001`, `\u2028`, and non-ASCII was canonicalized by both implementations: 4114 bytes, `cmp` identical. Each implementation's output was also re-parsed by itself.
- `blender --background --factory-startup --python` smoke on Blender 5.1.0 (bundled Python 3.13.9): both modules import, the fixture round-trips byte for byte, plain text raises `not_nodevault`.
- Not run: nothing in this slice touches a window, a node tree, or the real clipboard. Those arrive with the copy and paste PIDs.

## Review changes

Made during review of this checkpoint, before the next feature started:

- **Project renamed to NodeVault** (reviewer). Identifiers, format string (`nodevault.tree`), fixture name, package scope, and all PIDs renamed.
- **Magic line removed** (reviewer: the first line broke JSON validation of saved files). The clipboard and the file are now one plain JSON object. The object identifies itself through `format` and `format_version`, which already carried both jobs the magic line had: recognition and versioning. Removed `MAGIC`, `splitEnvelope` / `split_envelope`, `canonicalText` / `canonical_text`, and the `bad_magic` error code. A `format_version` other than `1` is refused with `bad_format_version`. No legacy tolerance for a leading `nodevault 1` line: nothing had shipped, and the PRD forbids a second dialect. Parsers tolerate surrounding whitespace, `\r\n`, and a UTF-8 BOM (the Python normalizer treats U+FEFF as whitespace to match `String.prototype.trim`). Recognition rule: trimmed text starts with `{` and contains `nodevault.tree`; text that passes that but fails to parse is `bad_json`, everything else is `not_nodevault`. Updated: PRD Decisions and Surfaces, PID 05 Text / Canonical JSON / Validation, and the prefix steps in PIDs 01, 02, 03, 04, 08, 10.
- **`blender_version_min` lowered to `5.0.0`** (reviewer). Any Blender 5.x. Add-on PID updated.

## Departures

- Added `packages/interchange/`. The PRD's repository sketch has no home for the TypeScript parser, validator, and canonical serializer; `packages/catalog` and `packages/node-view` are the wrong owners. `node-view` and `apps/web` will import this package.
- Tree key order: the PID's Trees schema block lists `nodes, links, interface`; the worked example lists `interface, nodes, links`. Implemented the worked example's order (`id, name, is_root, interface, nodes, links`). See Open.
- Integral floats serialize without a fraction in both languages (`140.0` → `140`, `-300.0` → `-300`). `JSON.stringify` cannot keep `.0`, and the PID says the browser copy must be byte-stable, so the Python side matches it rather than emitting `140.0`. Values are unchanged; only the spelling is. On paste, Blender receives a Python `int` for those values; `bpy` accepts `int` for float RNA properties. The paste PID's tests will confirm this on real nodes.
- `addon/tests/` lives inside the extension directory so the relative import `from .serialize import ...` is exercised the way Blender will run it. The manifest in the add-on PID must exclude `tests/` with `paths_exclude_pattern`.
- The fixture is hand-authored from the PID's worked example, not captured from Blender, hence the `fixtures/handwritten/` folder. Captured fixtures from the add-on will sit beside it.

## Next

Node catalog (`docs/pid/06-node-catalog.md`), first slice: `scripts/extract_node_catalog.py` run headless against the installed Blender 5.1.0, producing `catalog/versions/<version>/catalog.json` with themes, socket colors, categories, node records, the socket-layout probe, and zone detection. The loader (`packages/catalog`) is the slice after that.

## Open

- Tree key order: confirm `interface, nodes, links` (worked example) over `nodes, links, interface` (schema block), or the reverse. One line in the PID should change either way so the two agree. Carried forward unanswered; the implementation keeps the worked example's order until told otherwise.
- Resolved in review: `blender_version_min` is `5.0.0`.
- Resolved in review: nothing is committed by the agent; the reviewer commits.
