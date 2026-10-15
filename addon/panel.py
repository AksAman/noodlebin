"""Node editor N-panel and header submenu."""

from __future__ import annotations

from pathlib import Path

import bpy
from bpy.types import Menu, Panel

from .capture import load_affects_map


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


class NODEVAULT_MT_menu(Menu):
    bl_label = "NodeVault"
    bl_idname = "NODEVAULT_MT_menu"

    def draw(self, context):
        layout = self.layout
        layout.operator("nodevault.copy_nodes")
        layout.operator("nodevault.paste_nodes")
        layout.separator()
        layout.operator("nodevault.save_nodes")


def draw_header_menu(self, context):
    self.layout.menu("NODEVAULT_MT_menu")


class NODEVAULT_PT_panel(Panel):
    bl_label = "NodeVault"
    bl_idname = "NODEVAULT_PT_panel"
    bl_space_type = "NODE_EDITOR"
    bl_region_type = "UI"
    bl_category = "NodeVault"

    def draw(self, context):
        layout = self.layout
        layout.label(text=_tree_label(context))
        space = context.space_data
        if space and space.node_tree:
            count = sum(1 for n in space.node_tree.nodes if n.select)
            layout.label(text=f"{count} selected")
        layout.operator("nodevault.copy_nodes")
        layout.operator("nodevault.paste_nodes")
        layout.operator("nodevault.save_nodes")

        version = _addon_version()
        blender = bpy.app.version_string
        layout.separator()
        layout.label(text=f"NodeVault {version} · Blender {blender}")
        if load_affects_map(tuple(int(x) for x in bpy.app.version)) is None:
            layout.label(
                text="No catalog for this Blender. Same-version paste still works. Browser colors will be missing until a catalog is extracted."
            )


classes = (NODEVAULT_MT_menu, NODEVAULT_PT_panel)
