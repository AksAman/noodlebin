"""Node editor N-panel and header submenu."""
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

from pathlib import Path

import bpy
from bpy.types import Menu, Operator, Panel

from .capture import load_affects_map
from .rebuild import last_skips


def _addon_version() -> str:
    manifest = Path(__file__).resolve().parent / "blender_manifest.toml"
    try:
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if line.startswith("version"):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return "0.1.0"


def _tree_label(context) -> str:
    space = getattr(context, "space_data", None)
    if space is None or space.type != "NODE_EDITOR" or space.node_tree is None:
        return "No node tree"
    names = {
        "ShaderNodeTree": "Shader",
        "GeometryNodeTree": "Geometry Nodes",
        "CompositorNodeTree": "Compositor",
    }
    tt = space.tree_type or space.node_tree.bl_idname
    return names.get(tt, tt)


class NOODLEBIN_MT_menu(Menu):
    bl_label = "noodlebin"
    bl_idname = "NOODLEBIN_MT_menu"

    def draw(self, context):
        layout = self.layout
        layout.operator("noodlebin.copy_nodes")
        layout.operator("noodlebin.copy_all_nodes")
        layout.operator("noodlebin.paste_nodes")
        layout.operator("noodlebin.paste_replace_nodes")
        layout.separator()
        layout.operator("noodlebin.save_nodes")


def draw_header_menu(self, context):
    self.layout.menu("NOODLEBIN_MT_menu")


def _reload_after_operator():
    import importlib

    root = importlib.import_module(__package__)
    root.unregister()
    root.register()
    return None


class NOODLEBIN_OT_reload(Operator):
    bl_idname = "noodlebin.reload"
    bl_label = "Reload Add-on"
    bl_description = "Re-read noodlebin Python from disk"
    bl_options = {"INTERNAL"}

    def execute(self, context):
        # Unregistering this operator while execute() is running crashes Blender.
        bpy.app.timers.register(_reload_after_operator, first_interval=0.01)
        return {"FINISHED"}


class NOODLEBIN_PT_panel(Panel):
    bl_label = "noodlebin"
    bl_idname = "NOODLEBIN_PT_panel"
    bl_space_type = "NODE_EDITOR"
    bl_region_type = "UI"
    bl_category = "noodlebin"

    def draw(self, context):
        layout = self.layout
        layout.label(text=_tree_label(context))
        space = context.space_data
        if space and space.node_tree:
            count = sum(1 for n in space.node_tree.nodes if n.select)
            layout.label(text=f"{count} selected")
        layout.operator("noodlebin.copy_nodes")
        layout.operator("noodlebin.copy_all_nodes")
        layout.operator("noodlebin.paste_nodes")
        layout.operator("noodlebin.paste_replace_nodes")
        layout.operator("noodlebin.save_nodes")
        layout.operator("noodlebin.reload")

        if last_skips:
            box = layout.box()
            box.label(text="Last paste skips")
            for skip in last_skips:
                box.label(text=f"{skip.target}: {skip.reason}")

        version = _addon_version()
        blender = bpy.app.version_string
        layout.separator()
        layout.label(text=f"noodlebin {version} · Blender {blender}")
        if load_affects_map(tuple(int(x) for x in bpy.app.version)) is None:
            layout.label(
                text="No catalog for this Blender. Same-version paste still works. Browser colors will be missing until a catalog is extracted."
            )


classes = (NOODLEBIN_MT_menu, NOODLEBIN_OT_reload, NOODLEBIN_PT_panel)
