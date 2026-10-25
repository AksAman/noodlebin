#!/usr/bin/env python3
"""
Codemod: NoodleBin -> noodlebin
Run from the v2/ directory: python3 scripts/_rename.py
"""

import os
import sys
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).parent.parent.resolve()

# Directories / patterns to skip entirely
SKIP_DIRS = {
    "node_modules", ".next", ".venv", "dist", "__pycache__",
    ".git", "docs/checkpoints",
}
SKIP_EXTS = {".lock", ".zip", ".pyc", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".blend", ".mp4"}

# Ordered replacements: most-specific first to prevent double-substitution.
# Each entry is (old_bytes, new_bytes).
REPLACEMENTS = [
    # Pass 1 – npm scoped package prefix
    (b"@noodlebin/", b"@noodlebin/"),
    # Pass 2 – UPPER env-var / Blender class prefix
    (b"NOODLEBIN_", b"NOODLEBIN_"),
    (b"NOODLEBIN_OT_", b"NOODLEBIN_OT_"),  # belt+suspenders (already covered above)
    (b"NOODLEBIN_MT_", b"NOODLEBIN_MT_"),
    (b"NOODLEBIN_PT_", b"NOODLEBIN_PT_"),
    # Pass 3 – PascalCase identifiers (types, errors, class names)
    (b"NoodleBinError", b"NoodleBinError"),
    (b"NoodleBinPayload", b"NoodleBinPayload"),
    (b"NoodleBinNode", b"NoodleBinNode"),
    (b"NoodleBinTree", b"NoodleBinTree"),
    (b"NoodleBinLink", b"NoodleBinLink"),
    (b"NoodleBinErrorCode", b"NoodleBinErrorCode"),
    (b"parseNoodleBinText", b"parseNoodleBinText"),
    (b"safeParseNoodleBinText", b"safeParseNoodleBinText"),
    (b"looksLikeNoodleBin", b"looksLikeNoodleBin"),
    (b"isNoodleBinError", b"isNoodleBinError"),
    (b"NoodleBin", b"NoodleBin"),  # catch-all PascalCase (covers remaining prose too)
    # Pass 4 – mixed-case standalone Vault identifiers
    (b"NoodleBinPost", b"NoodleBinPost"),
    (b"NoodleBinError", b"NoodleBinError"),
    (b"NoodleBinPayload", b"NoodleBinPayload"),
    (b"NoodleBinNode", b"NoodleBinNode"),
    (b"NoodleBinTree", b"NoodleBinTree"),
    (b"NoodleBinText", b"NoodleBinText"),
    (b"NoodleBinLink", b"NoodleBinLink"),
    (b"NoodleBinErrorCode", b"NoodleBinErrorCode"),
    (b"_noodlebin_catalog", b"_noodlebin_catalog"),
    (b"_noodlebin_capture", b"_noodlebin_capture"),
    (b"_noodlebin_build", b"_noodlebin_build"),
    # Pass 5 – lowercase snake_case / kebab-case / plain
    # Specific compound forms first
    (b"noodlebin-pg", b"noodlebin-pg"),
    (b"blender-noodlebin", b"blender-noodlebin"),
    (b"noodlebin-0.1.0", b"noodlebin-0.1.0"),
    (b"noodlebin_build_addon", b"noodlebin_build_addon"),
    (b"looks_like_noodlebin", b"looks_like_noodlebin"),
    (b"deserialize.looks_like_noodlebin", b"deserialize.looks_like_noodlebin"),
    (b"not_noodlebin", b"not_noodlebin"),
    # The clipboard format tag
    (b"noodlebin.tree", b"noodlebin.tree"),
    (b"noodlebin.paste", b"noodlebin.paste"),
    (b"noodlebin.theme", b"noodlebin.theme"),
    (b"noodlebin.share-draft", b"noodlebin.share-draft"),
    (b"noodlebin.reload", b"noodlebin.reload"),
    (b"noodlebin.copy_nodes", b"noodlebin.copy_nodes"),
    (b"noodlebin.copy_all_nodes", b"noodlebin.copy_all_nodes"),
    (b"noodlebin.paste_nodes", b"noodlebin.paste_nodes"),
    (b"noodlebin.paste_replace_nodes", b"noodlebin.paste_replace_nodes"),
    (b"noodlebin.save_nodes", b"noodlebin.save_nodes"),
    (b"noodlebin.other", b"noodlebin.other"),
    (b"noodlebin.share-", b"noodlebin.share-"),
    # File extension
    (b".noodlebin.json", b".noodlebin.json"),
    # x-noodlebin-embed header
    (b"x-noodlebin-embed", b"x-noodlebin-embed"),
    # DB / URL plain forms
    (b"/noodlebin", b"/noodlebin"),
    # The author_slug used in seeded posts
    (b'"noodlebin"', b'"noodlebin"'),
    # Catch-all (must be last)
    (b"noodlebin", b"noodlebin"),
]


def should_skip(path: pathlib.Path) -> bool:
    parts = path.parts
    for skip in SKIP_DIRS:
        if any(p == skip for p in parts):
            return True
        if "/" in skip:
            sub = pathlib.PurePosixPath(skip)
            for i in range(len(parts)):
                if pathlib.PurePosixPath(*parts[i:i+len(sub.parts)]) == sub:
                    return True
    if path.suffix in SKIP_EXTS:
        return True
    return False


def process_file(path: pathlib.Path) -> int:
    try:
        data = path.read_bytes()
    except Exception as e:
        print(f"  SKIP (read error) {path}: {e}", file=sys.stderr)
        return 0
    
    original = data
    for old, new in REPLACEMENTS:
        data = data.replace(old, new)
    
    if data != original:
        try:
            path.write_bytes(data)
        except Exception as e:
            print(f"  SKIP (write error) {path}: {e}", file=sys.stderr)
            return 0
        return 1
    return 0


def main():
    changed = 0
    skipped = 0
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if should_skip(rel):
            skipped += 1
            continue
        n = process_file(path)
        if n:
            print(f"  CHANGED: {rel}")
            changed += 1
    print(f"\nDone: {changed} files changed, {skipped} skipped.")


if __name__ == "__main__":
    main()
