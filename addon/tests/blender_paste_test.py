"""Paste acceptance tests. Run inside Blender, no window required.

Calls rebuild.paste_payload directly (operators need space_data).

blender --background --factory-startup --python addon/tests/blender_paste_test.py
"""

from __future__ import annotations

import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import bpy

from addon.capture import capture_nodes
from addon.deserialize import parse_clipboard_text
from addon.rebuild import TreeTypeMismatch, last_skips, paste_payload
from addon.serialize import canonical_json

FIXTURES = ROOT / "fixtures" / "handwritten"


def shader_tree():
    mat = bpy.data.materials.new("_nv_paste_shader")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    return tree


def geo_tree():
    return bpy.data.node_groups.new("_nv_paste_geo", "GeometryNodeTree")


def _close(a, b, eps=1e-5):
    return abs(float(a) - float(b)) < eps


def test_shader_links_and_ramp():
    src = shader_tree()
    noise = src.nodes.new("ShaderNodeTexNoise")
    ramp = src.nodes.new("ShaderNodeValToRGB")
    bsdf = src.nodes.new("ShaderNodeBsdfPrincipled")
    noise.location = (-400, 0)
    ramp.location = (-150, 0)
    bsdf.location = (200, 0)
    noise.inputs["Scale"].default_value = 5
    ramp.color_ramp.elements.new(0.5)
    ramp.color_ramp.elements[1].position = 0.5
    ramp.color_ramp.elements[1].color = (0.25, 0.5, 0.75, 1)
    src.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    src.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    selected = [noise, ramp, bsdf]
    for n in selected:
        n.select = True
    payload = capture_nodes(src, selected, tree_type="ShaderNodeTree")
    parse_clipboard_text(canonical_json(payload))

    dst = shader_tree()
    result = paste_payload(dst, payload, cursor=(0, 0), editor_tree_type="ShaderNodeTree")
    assert result.nodes == 3, result
    assert result.links == 2, result
    ids = {n.bl_idname for n in dst.nodes}
    assert "ShaderNodeTexNoise" in ids
    assert "ShaderNodeValToRGB" in ids
    assert "ShaderNodeBsdfPrincipled" in ids
    live_ramp = next(n for n in dst.nodes if n.bl_idname == "ShaderNodeValToRGB")
    assert len(live_ramp.color_ramp.elements) == 3
    mids = [el for el in live_ramp.color_ramp.elements if _close(el.position, 0.5)]
    assert mids, [el.position for el in live_ramp.color_ramp.elements]
    assert _close(mids[0].color[0], 0.25)
    ident_links = {(l.from_socket.identifier, l.to_socket.identifier) for l in dst.links}
    assert ("Fac", "Fac") in ident_links
    assert ("Color", "Base Color") in ident_links
    live_noise = next(n for n in dst.nodes if n.bl_idname == "ShaderNodeTexNoise")
    assert _close(live_noise.inputs["Scale"].default_value, 5)
    return "shader links + ramp"


def test_fixture_ramp():
    text = (FIXTURES / "three-stop-ramp.nodevault.json").read_text(encoding="utf-8")
    payload = parse_clipboard_text(text)
    dst = shader_tree()
    result = paste_payload(dst, payload, cursor=(10, 20), editor_tree_type="ShaderNodeTree")
    assert result.nodes == 1, result
    node = dst.nodes[0]
    assert node.bl_idname == "ShaderNodeValToRGB"
    assert len(node.color_ramp.elements) == 3
    assert _close(node.location[0], 10)
    assert _close(node.location[1], 20)
    return "fixture ramp at cursor"


def test_tree_type_mismatch():
    src = shader_tree()
    a = src.nodes.new("ShaderNodeRGB")
    a.select = True
    payload = capture_nodes(src, [a], tree_type="ShaderNodeTree")
    dst = geo_tree()
    before = len(dst.nodes)
    names_before = {n.name for n in dst.nodes}
    try:
        paste_payload(dst, payload, cursor=(0, 0), editor_tree_type="GeometryNodeTree")
        raise AssertionError("expected TreeTypeMismatch")
    except TreeTypeMismatch as exc:
        msg = str(exc).lower()
        assert "shader" in msg and "geometry" in msg, msg
    assert len(dst.nodes) == before
    assert {n.name for n in dst.nodes} == names_before
    return "shader into geometry names both types"


def test_existing_group_untouched():
    original = bpy.data.node_groups.new("Inner", "ShaderNodeTree")
    marker = original.nodes.new("ShaderNodeValue")
    marker.label = "keep-me"
    before_count = len(original.nodes)
    text = (FIXTURES / "group-inner.nodevault.json").read_text(encoding="utf-8")
    payload = parse_clipboard_text(text)
    dst = shader_tree()
    result = paste_payload(dst, payload, cursor=(0, 0), editor_tree_type="ShaderNodeTree")
    assert result.nodes >= 1
    assert original.name == "Inner"
    assert len(original.nodes) == before_count
    assert any(n.label == "keep-me" for n in original.nodes)
    copies = [g for g in bpy.data.node_groups if g.name.startswith("Inner")]
    assert len(copies) >= 2, [g.name for g in copies]
    inst = next(n for n in dst.nodes if n.bl_idname == "ShaderNodeGroup")
    assert inst.node_tree is not original
    return "existing group name creates a copy"


def test_unknown_bl_idname_skips():
    src = shader_tree()
    a = src.nodes.new("ShaderNodeRGB")
    b = src.nodes.new("ShaderNodeBsdfPrincipled")
    a.select = True
    b.select = True
    payload = capture_nodes(src, [a, b], tree_type="ShaderNodeTree")
    victim = next(n for n in payload["trees"][0]["nodes"] if n["bl_idname"] == "ShaderNodeRGB")
    victim["bl_idname"] = "ShaderNodeDoesNotExist"
    dst = shader_tree()
    result = paste_payload(dst, payload, cursor=(0, 0), editor_tree_type="ShaderNodeTree")
    assert result.nodes == 1, result
    assert {n.bl_idname for n in dst.nodes} == {"ShaderNodeBsdfPrincipled"}
    assert any(s.reason == "unknown type" and "DoesNotExist" in s.target for s in result.skips)
    assert any(s.reason == "unknown type" for s in last_skips)
    return "unknown type listed, other node pasted"


def test_frame_parent_roundtrip():
    src = shader_tree()
    frame = src.nodes.new("NodeFrame")
    frame.location = (100, 50)
    child = src.nodes.new("ShaderNodeRGB")
    child.parent = frame
    child.location = (20, 10)
    child.select = True
    frame.select = True
    payload = capture_nodes(src, [child, frame], tree_type="ShaderNodeTree")
    dst = shader_tree()
    paste_payload(dst, payload, cursor=(0, 0), editor_tree_type="ShaderNodeTree")
    live_frame = next(n for n in dst.nodes if n.bl_idname == "NodeFrame")
    live_child = next(n for n in dst.nodes if n.bl_idname == "ShaderNodeRGB")
    assert live_child.parent == live_frame
    return "frame parent after paste"


def test_register_paste_operator():
    from addon import register, unregister

    register()
    assert hasattr(bpy.types, "NODEVAULT_OT_paste_nodes")
    op = bpy.types.NODEVAULT_OT_paste_nodes
    assert "UNDO" in op.bl_options
    assert hasattr(bpy.types, "NODEVAULT_OT_reload")
    unregister()
    return "paste operator registered with UNDO"


TESTS = [
    test_shader_links_and_ramp,
    test_fixture_ramp,
    test_tree_type_mismatch,
    test_existing_group_untouched,
    test_unknown_bl_idname_skips,
    test_frame_parent_roundtrip,
    test_register_paste_operator,
]


def main() -> int:
    failed = 0
    for fn in TESTS:
        try:
            label = fn()
            print("PASS", label)
        except Exception:
            failed += 1
            print("FAIL", fn.__name__)
            traceback.print_exc()
    print(f"blender_paste {len(TESTS) - failed}/{len(TESTS)} passed  blender={bpy.app.version_string}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
