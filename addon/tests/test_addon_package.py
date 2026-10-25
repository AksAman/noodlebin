"""Vendoring catalogs for the extension zip. Stdlib only."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build_addon.py"


def _load_build_addon():
    spec = importlib.util.spec_from_file_location("noodlebin_build_addon", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class VendorCatalogsTest(unittest.TestCase):
    def test_copies_shipped_catalogs(self):
        build = _load_build_addon()
        src = ROOT / "catalog" / "versions"
        with tempfile.TemporaryDirectory() as tmp:
            dst = Path(tmp) / "versions"
            copied = build.vendor_catalogs(src, dst)
            names = {p.parent.name for p in copied}
            self.assertIn("5.1.0", names)
            self.assertIn("5.2.2_LTS", names)
            for path in copied:
                self.assertTrue(path.is_file())
                self.assertGreater(path.stat().st_size, 100)

    def test_zip_name_follows_manifest_version(self):
        build = _load_build_addon()
        self.assertEqual(build.manifest_version(), "0.1.0")
        self.assertEqual(build.DIST.joinpath("noodlebin-0.1.0.zip").name, f"noodlebin-{build.manifest_version()}.zip")

    def test_missing_source_raises(self):
        build = _load_build_addon()
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                build.vendor_catalogs(Path(tmp) / "missing", Path(tmp) / "out")


if __name__ == "__main__":
    unittest.main()
