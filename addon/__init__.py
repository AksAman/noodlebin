"""noodlebin Blender extension.

Plain python3 tests import serialize/deserialize as submodules without calling
register(), so they do not need bpy.
"""
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

# ---------------------------------------------------------------------------
# Reload support — must live at module level so Blender's "Reload Scripts"
# picks it up.  On first load "bpy" is not yet in this module's namespace;
# on a subsequent reload it is, so we re-import each submodule.
# See: https://developer.blender.org/docs/handbook/extensions/addon_dev_setup/#reloading-scripts
# ---------------------------------------------------------------------------
if "bpy" in locals():
    from importlib import reload as _reload
    _reload(serialize)    # noqa: F821
    _reload(deserialize)  # noqa: F821
    _reload(capture)      # noqa: F821
    _reload(rebuild)      # noqa: F821
    _reload(copy_nodes)   # noqa: F821
    _reload(paste_nodes)  # noqa: F821
    _reload(panel)        # noqa: F821
    del _reload

# Guard lets the plain-Python unit tests import submodules without Blender.
try:
    import bpy  # noqa: E402
    from . import serialize, deserialize, capture, rebuild, copy_nodes, paste_nodes, panel  # noqa: E402, F401
except ImportError:
    bpy = None  # type: ignore[assignment]

addon_keymaps: list = []


def register() -> None:
    if bpy is None:
        return
    for cls in (*copy_nodes.classes, *paste_nodes.classes, *panel.classes):
        bpy.utils.register_class(cls)
    bpy.types.NODE_HT_header.append(panel.draw_header_menu)

    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if kc:
        km = kc.keymaps.new(name="Node Editor", space_type="NODE_EDITOR")
        for keys in (
            {"ctrl": True, "shift": True, "oskey": False},
            {"ctrl": False, "shift": True, "oskey": True},
        ):
            kmi = km.keymap_items.new("noodlebin.copy_nodes", "C", "PRESS", **keys)
            addon_keymaps.append((km, kmi))
            kmi = km.keymap_items.new("noodlebin.paste_nodes", "V", "PRESS", **keys)
            addon_keymaps.append((km, kmi))
        for keys in (
            {"ctrl": True, "shift": True, "alt": True, "oskey": False},
            {"ctrl": False, "shift": True, "alt": True, "oskey": True},
        ):
            kmi = km.keymap_items.new("noodlebin.copy_all_nodes", "C", "PRESS", **keys)
            addon_keymaps.append((km, kmi))
            kmi = km.keymap_items.new("noodlebin.paste_replace_nodes", "V", "PRESS", **keys)
            addon_keymaps.append((km, kmi))


def unregister() -> None:
    if bpy is None:
        return
    for km, kmi in addon_keymaps:
        try:
            km.keymap_items.remove(kmi)
        except Exception:
            pass
    addon_keymaps.clear()

    try:
        bpy.types.NODE_HT_header.remove(panel.draw_header_menu)
    except Exception:
        pass
    for cls in reversed((*panel.classes, *paste_nodes.classes, *copy_nodes.classes)):
        try:
            bpy.utils.unregister_class(cls)
        except Exception:
            pass
