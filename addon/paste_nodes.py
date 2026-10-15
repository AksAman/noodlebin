"""Paste operator. Rebuild algorithm is rebuild.py / docs/pid/04-paste-in-blender.md."""

from __future__ import annotations

from bpy.types import Operator

from .deserialize import NodeVaultError, parse_clipboard_text
from .rebuild import TreeTypeMismatch, paste_payload
from .serialize import TREE_TYPES


def _report_result(op: Operator, result) -> set[str]:
    skips = result.skips
    skipped_nodes = sum(1 for s in skips if s.reason == "unknown type")
    skipped_links = sum(1 for s in skips if s.reason == "unknown socket")
    msg = f"Pasted {result.nodes} nodes and {result.links} links."
    if skips:
        if skipped_nodes or skipped_links:
            msg += f" Skipped {skipped_nodes} nodes and {skipped_links} links."
        else:
            msg += f" Skipped {len(skips)}."
    if result.nodes == 0:
        op.report({"WARNING"} if skips else {"ERROR"}, msg if skips else "Nothing pasted.")
        return {"CANCELLED"}
    op.report({"WARNING"} if skips else {"INFO"}, msg)
    return {"FINISHED"}


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
        text = context.window_manager.clipboard or ""
        try:
            payload = parse_clipboard_text(text)
        except NodeVaultError as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}

        space = context.space_data
        tree = space.node_tree
        created_before = {n.as_pointer() for n in tree.nodes}
        try:
            result = paste_payload(
                tree,
                payload,
                cursor=space.cursor_location,
                editor_tree_type=space.tree_type,
            )
        except TreeTypeMismatch as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        except Exception as exc:
            self.report({"ERROR"}, str(exc).split("\n")[0][:200])
            created = any(n.as_pointer() not in created_before for n in tree.nodes)
            return {"FINISHED"} if created else {"CANCELLED"}

        return _report_result(self, result)


classes = (NODEVAULT_OT_paste_nodes,)
