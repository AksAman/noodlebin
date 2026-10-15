"""Vendor catalogs into the add-on and build the extension zip.

Catalogs live in catalog/versions (the extract command). The zip must contain
addon/catalog/versions so Install from Disk has them. The repo symlink still
loads ../catalog/versions when addon/catalog is absent.

    python3 scripts/build_addon.py
    python3 scripts/build_addon.py --vendor-only

Owned by docs/pid/08-addon.md.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_SRC = ROOT / "catalog" / "versions"
ADDON = ROOT / "addon"
CATALOG_DST = ADDON / "catalog" / "versions"
DIST = ROOT / "dist"


def vendor_catalogs(src: Path, dst: Path) -> list[Path]:
    if not src.is_dir():
        raise FileNotFoundError(f"catalog source missing: {src}")
    if dst.exists():
        shutil.rmtree(dst)
    copied: list[Path] = []
    for child in sorted(src.iterdir()):
        catalog = child / "catalog.json"
        if not catalog.is_file():
            continue
        target_dir = dst / child.name
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / "catalog.json"
        shutil.copy2(catalog, target)
        copied.append(target)
    if not copied:
        raise FileNotFoundError(f"no catalog.json under {src}")
    return copied


def build_zip(blender: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    cmd = [
        str(blender),
        "--command",
        "extension",
        "build",
        "--source-dir",
        str(ADDON),
        "--output-filepath",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def default_blender() -> Path:
    import os

    env = os.environ.get("BLENDER")
    if env:
        path = Path(env)
        if path.is_file():
            return path
    which = shutil.which("blender")
    if which:
        return Path(which)
    home = Path.home()
    for candidate in (
        Path("/Applications/Blender_52.app/Contents/MacOS/Blender"),
        Path("/Applications/Blender.app/Contents/MacOS/Blender"),
        home / "blender" / "blender-5.2.2-linux-x64" / "blender",
        home / "blender" / "blender-5.1.0-linux-x64" / "blender",
    ):
        if candidate.is_file():
            return candidate
    return Path("blender")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vendor-only", action="store_true")
    parser.add_argument(
        "--blender",
        type=Path,
        default=default_blender(),
        help="Blender binary for extension build",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DIST / "nodevault-0.1.0.zip",
    )
    ns = parser.parse_args()
    copied = vendor_catalogs(CATALOG_SRC, CATALOG_DST)
    print("vendored:")
    for path in copied:
        print(f"  {path.relative_to(ROOT)}")
    if ns.vendor_only:
        return 0
    build_zip(ns.blender, ns.output)
    print(f"zip: {ns.output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(exc.returncode)
