"""Copy operator. Capture algorithm is capture.py; this is the bpy operator."""
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import bpy
from bpy.types import Operator

from .capture import CaptureError, capture_text, poll_copy

_TWO_MB = 2 * 1024 * 1024


def _write_clipboard(op: Operator, context, text: str) -> set[str]:
    from . import deserialize

    payload = deserialize.parse_clipboard_text(text)
    context.window_manager.clipboard = text
    count = payload["origin"]["node_count"]
    tree_type = payload["tree_type"]
    warnings = payload["origin"].get("warnings") or []
    if len(text.encode("utf-8")) > _TWO_MB:
        op.report(
            {"WARNING"},
            f"Copied {count} nodes from {tree_type} ({len(text.encode('utf-8'))} bytes). Payload is over 2 MB.",
        )
    elif warnings:
        op.report(
            {"WARNING"},
            f"Copied {count} nodes from {tree_type} with {len(warnings)} warning(s).",
        )
    else:
        op.report({"INFO"}, f"Copied {count} nodes from {tree_type}.")
    return {"FINISHED"}


def _native_copy() -> str | None:
    try:
        bpy.ops.node.clipboard_copy()
        return None
    except RuntimeError as exc:
        return str(exc).split("\n")[0][:200] or "Blender copy cancelled"


class NOODLEBIN_OT_copy_nodes(Operator):
    bl_idname = "noodlebin.copy_nodes"
    bl_label = "Copy Nodes"
    bl_description = "Copy selected nodes as noodlebin JSON on the system clipboard"
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
        err = _native_copy()
        if err:
            self.report({"ERROR"}, err)
            return {"CANCELLED"}

        try:
            text = capture_text(tree, selected, tree_type=space.tree_type)
        except CaptureError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        return _write_clipboard(self, context, text)


class NOODLEBIN_OT_copy_all_nodes(Operator):
    bl_idname = "noodlebin.copy_all_nodes"
    bl_label = "Copy All Nodes"
    bl_description = "Copy every node in this tree as noodlebin JSON on the system clipboard"
    bl_options = {"REGISTER"}

    @classmethod
    def poll(cls, context):
        ok, reason = poll_copy(context, all_nodes=True)
        if not ok:
            cls.poll_message_set(reason)
        return ok

    def execute(self, context):
        from .rebuild import clear_skips

        clear_skips()
        space = context.space_data
        tree = space.node_tree
        nodes = list(tree.nodes)
        prev = {n.as_pointer(): bool(n.select) for n in nodes}
        for node in nodes:
            node.select = True
        err = _native_copy()
        for node in tree.nodes:
            node.select = prev.get(node.as_pointer(), False)
        if err:
            self.report({"ERROR"}, err)
            return {"CANCELLED"}

        try:
            text = capture_text(tree, nodes, tree_type=space.tree_type)
        except CaptureError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        return _write_clipboard(self, context, text)


class NOODLEBIN_OT_save_nodes(Operator):
    bl_idname = "noodlebin.save_nodes"
    bl_label = "Save Nodes"
    bl_description = "Save selected nodes as a .noodlebin.json file"
    bl_options = {"REGISTER"}
    filename_ext = ".noodlebin.json"
    filter_glob: bpy.props.StringProperty(default="*.noodlebin.json;*.json", options={"HIDDEN"})
    filepath: bpy.props.StringProperty(subtype="FILE_PATH")

    @classmethod
    def poll(cls, context):
        ok, reason = poll_copy(context)
        if not ok:
            cls.poll_message_set(reason)
        return ok

    def invoke(self, context, event):
        if not self.filepath:
            self.filepath = "nodes.noodlebin.json"
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


classes = (NOODLEBIN_OT_copy_nodes, NOODLEBIN_OT_copy_all_nodes, NOODLEBIN_OT_save_nodes)
