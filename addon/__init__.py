"""NoodleBin Blender extension. Register is the only bpy import at load time.

Plain python3 tests import serialize/deserialize as submodules without calling
register(), so they do not need bpy.

Disable/enable (or the N-panel Reload) re-executes submodules. A symlink
alone does not, because Python keeps the old module objects in sys.modules.
"""
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

addon_keymaps = []

_SUBMODULES = (
    "serialize",
    "deserialize",
    "capture",
    "rebuild",
    "copy_nodes",
    "paste_nodes",
    "panel",
)


def reload_modules():
    import importlib

    for name in _SUBMODULES:
        mod = importlib.import_module(f".{name}", __package__)
        importlib.reload(mod)


def register():
    import bpy

    reload_modules()
    from . import copy_nodes, panel, paste_nodes

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


def unregister():
    import bpy

    from . import copy_nodes, panel, paste_nodes

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
