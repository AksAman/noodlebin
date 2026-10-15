# Checkpoint 0008 — Vendor catalogs into the extension zip

- Date: 2026-10-15
- PID: docs/pid/08-addon.md (packaging); docs/pid/06-node-catalog.md (where catalogs live)
- Status: ready for review

## Done

`catalog/versions` is copied into `addon/catalog/versions` at build time and packed in the extension zip. Install from Disk then has 5.1.0 and 5.2.2 LTS catalogs. They are not generated on the user's machine.

The repo copy stays the source of truth. `addon/catalog/` is gitignored. The add-on still also reads `../catalog/versions`, so the dev symlink works without vendoring.

```bash
cd v2
python3 scripts/build_addon.py
# dist/nodevault-0.1.0.zip
python3 scripts/build_addon.py --vendor-only
```

Install: Blender → Preferences → Extensions → Install from Disk → that zip.

## Files

- `scripts/build_addon.py` — vendor then `blender --command extension build`.
- `addon/tests/test_addon_package.py` — copy of both shipped catalogs into a temp dir.
- `addon/blender_manifest.toml` — exclude `.vscode/` as well as `tests/`.

## Verified

- `python3 -m unittest discover -s addon/tests -t .`: 38 pass.
- `python3 scripts/build_addon.py`: zip contains `catalog/versions/5.1.0/catalog.json` and `catalog/versions/5.2.2_LTS/catalog.json`, 11 files, no `tests/`.
- `blender --command extension validate addon`: Success parsing TOML.

## Departures

- Catalogs are not committed under `addon/catalog/`. A raw `blender --command extension build` from `addon/` without the script omits them. Use `scripts/build_addon.py`.

## Next

Sharing (`docs/pid/09-sharing.md`) is specified and secondary. Embedding (`docs/pid/10-embedding.md`) after that. The core clipboard loop is complete.

## Open

- Copy All / Paste and Replace still not written into the copy/paste PIDs.
- Handwritten two-node fixture still 5.0.1.
- 200-node geometry fixture for the visualizer.
