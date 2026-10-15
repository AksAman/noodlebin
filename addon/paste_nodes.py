"""Paste operator stub. Rebuild algorithm is docs/pid/04-paste-in-blender.md."""

from __future__ import annotations

from bpy.types import Operator

from .serialize import TREE_TYPES


class NODEVAULT_OT_paste_nodes(Operator):
    bl_idname = "nodevault.paste_nodes"
    bl_label = "Paste Nodes"
    bl_description = "Paste a NodeVault JSON clipboard into this node editor"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        space = getattr(context, "space_data", None)
        if space is None or getattr(space, "type", None) != "NODE_EDITOR":
            return False
        tree = getattr(space, "node_tree", None)
        if tree is None:
            cls.poll_message_set("no node tree")
            return False
        tree_type = getattr(space, "tree_type", "") or getattr(tree, "bl_idname", "")
        if tree_type not in TREE_TYPES:
            cls.poll_message_set("unsupported editor")
            return False
        if hasattr(tree, "is_editable") and not tree.is_editable:
            cls.poll_message_set("no node tree")
            return False
        return True

    def execute(self, context):
        self.report({"ERROR"}, "Paste is not in this build")
        return {"CANCELLED"}


classes = (NODEVAULT_OT_paste_nodes,)
