#!/usr/bin/env python3
"""Symlink v2/addon into Blender's user extension folders (5.1 and 5.2).

Install from Disk wants a zip. This is the other way: one folder, both
Blenders, no reinstall after edits. Blender still only reloads Python when
you disable/enable NodeVault or restart. The symlink just means the files
it reloads are these ones.

    python3 scripts/link_dev_addon.py
    python3 scripts/link_dev_addon.py --unlink
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ADDON_ID = "nodevault"
VERSIONS = ("5.1", "5.2")
REPO_ADDON = Path(__file__).resolve().parents[1] / "addon"
USER_SUPPORT = Path.home() / "Library" / "Application Support" / "Blender"


def dest_for(version: str) -> Path:
    return USER_SUPPORT / version / "extensions" / "user_default" / ADDON_ID


def link_one(version: str, *, unlink: bool) -> int:
    dest = dest_for(version)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_symlink() or dest.exists():
        if dest.is_symlink():
            current = dest.resolve()
            dest.unlink()
            print(f"{version}: removed symlink -> {current}")
        else:
            print(f"{version}: {dest} exists and is not a symlink; leaving it", file=sys.stderr)
            return 1
        if unlink:
            return 0
    elif unlink:
        print(f"{version}: no link at {dest}")
        return 0
    dest.symlink_to(REPO_ADDON, target_is_directory=True)
    print(f"{version}: {dest} -> {REPO_ADDON}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unlink", action="store_true")
    ns = parser.parse_args()
    if not REPO_ADDON.is_dir():
        print(f"missing {REPO_ADDON}", file=sys.stderr)
        return 1
    status = 0
    for version in VERSIONS:
        status |= link_one(version, unlink=ns.unlink)
    if not ns.unlink:
        print(
            "\nIn each Blender: Edit → Preferences → Extensions, enable NodeVault.\n"
            "After Python edits: NodeVault N-panel → Reload Add-on (or disable/enable).\n"
            "A running session that loaded an older register() still needs one restart."
        )
    return status


if __name__ == "__main__":
    raise SystemExit(main())
