"""NodeVault Blender extension. Register is the only bpy import at load time.

Plain python3 tests import serialize/deserialize as submodules without calling
register(), so they do not need bpy.
"""

from __future__ import annotations

addon_keymaps = []


def register():
    import bpy

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
            kmi = km.keymap_items.new("nodevault.copy_nodes", "C", "PRESS", **keys)
            addon_keymaps.append((km, kmi))
            kmi = km.keymap_items.new("nodevault.paste_nodes", "V", "PRESS", **keys)
            addon_keymaps.append((km, kmi))


def unregister():
    import bpy

    from . import copy_nodes, panel, paste_nodes

    for km, kmi in addon_keymaps:
        km.keymap_items.remove(kmi)
    addon_keymaps.clear()

    try:
        bpy.types.NODE_HT_header.remove(panel.draw_header_menu)
    except Exception:
        pass
    for cls in reversed((*panel.classes, *paste_nodes.classes, *copy_nodes.classes)):
        bpy.utils.unregister_class(cls)
