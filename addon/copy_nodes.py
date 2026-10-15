"""Copy operator. Capture algorithm is capture.py; this is the bpy operator."""

from __future__ import annotations

import bpy
from bpy.types import Operator

from .capture import CaptureError, capture_text, poll_copy

_TWO_MB = 2 * 1024 * 1024


class NODEVAULT_OT_copy_nodes(Operator):
    bl_idname = "nodevault.copy_nodes"
    bl_label = "Copy Nodes"
    bl_description = "Copy selected nodes as NodeVault JSON on the system clipboard"
    bl_options = {"REGISTER"}

    @classmethod
    def poll(cls, context):
        ok, reason = poll_copy(context)
        if not ok:
            cls.poll_message_set(reason)
        return ok

    def execute(self, context):
        from .rebuild import clear_skips

        clear_skips()
        space = context.space_data
        tree = space.node_tree
        selected = [n for n in tree.nodes if n.select]
        try:
            bpy.ops.node.clipboard_copy()
        except RuntimeError as exc:
            self.report({"ERROR"}, str(exc).split("\n")[0][:200] or "Blender copy cancelled")
            return {"CANCELLED"}

        try:
            text = capture_text(tree, selected, tree_type=space.tree_type)
        except CaptureError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}

        from . import deserialize

        payload = deserialize.parse_clipboard_text(text)
        context.window_manager.clipboard = text
        count = payload["origin"]["node_count"]
        tree_type = payload["tree_type"]
        warnings = payload["origin"].get("warnings") or []
        size_note = ""
        if len(text.encode("utf-8")) > _TWO_MB:
            size_note = f" ({len(text.encode('utf-8'))} bytes)"
            self.report(
                {"WARNING"},
                f"Copied {count} nodes from {tree_type}{size_note}. Payload is over 2 MB.",
            )
        elif warnings:
            self.report(
                {"WARNING"},
                f"Copied {count} nodes from {tree_type} with {len(warnings)} warning(s).",
            )
        else:
            self.report({"INFO"}, f"Copied {count} nodes from {tree_type}.")
        return {"FINISHED"}


class NODEVAULT_OT_save_nodes(Operator):
    bl_idname = "nodevault.save_nodes"
    bl_label = "Save Nodes"
    bl_description = "Save selected nodes as a .nodevault.json file"
    bl_options = {"REGISTER"}
    filename_ext = ".nodevault.json"
    filter_glob: bpy.props.StringProperty(default="*.nodevault.json;*.json", options={"HIDDEN"})
    filepath: bpy.props.StringProperty(subtype="FILE_PATH")

    @classmethod
    def poll(cls, context):
        ok, reason = poll_copy(context)
        if not ok:
            cls.poll_message_set(reason)
        return ok

    def invoke(self, context, event):
        if not self.filepath:
            self.filepath = "nodes.nodevault.json"
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}

    def execute(self, context):
        space = context.space_data
        tree = space.node_tree
        selected = [n for n in tree.nodes if n.select]
        try:
            text = capture_text(tree, selected, tree_type=space.tree_type)
        except CaptureError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        path = bpy.path.abspath(self.filepath)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        self.report({"INFO"}, f"Saved {path}")
        return {"FINISHED"}


classes = (NODEVAULT_OT_copy_nodes, NODEVAULT_OT_save_nodes)
