"""Capture acceptance tests. Run inside Blender, no window required.

blender --background --factory-startup --python addon/tests/blender_capture_test.py
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import bpy

from addon.capture import capture_nodes
from addon.deserialize import parse_clipboard_text
from addon.serialize import canonical_json


def _strip_copied_at(payload: dict) -> dict:
    data = json.loads(json.dumps(payload))
    data.pop("copied_at", None)
    return data


def shader_tree():
    mat = bpy.data.materials.new("_nv_shader")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    return tree


def geo_tree():
    return bpy.data.node_groups.new("_nv_geo", "GeometryNodeTree")


def test_two_linked_shader():
    tree = shader_tree()
    noise = tree.nodes.new("ShaderNodeTexNoise")
    bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
    noise.location = (-300, 0)
    bsdf.location = (0, 0)
    fac = noise.outputs.get("Fac") or noise.outputs[0]
    rough = bsdf.inputs.get("Roughness")
    tree.links.new(fac, rough)
    noise.select = True
    bsdf.select = True
    payload = capture_nodes(tree, [noise, bsdf], tree_type="ShaderNodeTree")
    parse_clipboard_text(canonical_json(payload))
    links = payload["trees"][0]["links"]
    assert len(links) == 1, links
    assert links[0]["from_socket"]["identifier"] == "Fac"
    assert links[0]["to_socket"]["identifier"] == "Roughness"
    ids = {n["bl_idname"] for n in payload["trees"][0]["nodes"]}
    assert ids == {"ShaderNodeTexNoise", "ShaderNodeBsdfPrincipled"}
    return "shader two-node link"


def test_unselected_link_dropped():
    tree = shader_tree()
    a = tree.nodes.new("ShaderNodeTexNoise")
    b = tree.nodes.new("ShaderNodeBsdfPrincipled")
    c = tree.nodes.new("ShaderNodeRGB")
    tree.links.new(a.outputs.get("Fac") or a.outputs[0], b.inputs.get("Roughness"))
    a.select = True
    b.select = True
    c.select = False
    payload = capture_nodes(tree, [a, b], tree_type="ShaderNodeTree")
    assert len(payload["trees"][0]["links"]) == 1
    assert len(payload["trees"][0]["nodes"]) == 2
    return "unselected node omitted"


def test_frame_parent():
    tree = shader_tree()
    frame = tree.nodes.new("NodeFrame")
    frame.location = (100, 50)
    child = tree.nodes.new("ShaderNodeRGB")
    child.parent = frame
    child.location = (20, 10)
    child.select = True
    frame.select = False
    payload = capture_nodes(tree, [child], tree_type="ShaderNodeTree")
    nodes = {n["id"]: n for n in payload["trees"][0]["nodes"]}
    assert len(nodes) == 2
    rgb = next(n for n in nodes.values() if n["bl_idname"] == "ShaderNodeRGB")
    fr = next(n for n in nodes.values() if n["bl_idname"] == "NodeFrame")
    assert rgb["parent_id"] == fr["id"]
    assert rgb["location"] != rgb["location_absolute"]
    return "frame parent_id"


def test_ramp_three_stops():
    tree = shader_tree()
    node = tree.nodes.new("ShaderNodeValToRGB")
    ramp = node.color_ramp
    ramp.elements.new(0.5)
    assert len(ramp.elements) == 3
    node.select = True
    payload = capture_nodes(tree, [node], tree_type="ShaderNodeTree")
    rec = payload["trees"][0]["nodes"][0]
    els = rec["widgets"]["color_ramp"]["elements"]
    assert len(els) == 3, els
    assert all("position" in e and "color" in e for e in els)
    return "ramp three stops"


def test_stable_except_copied_at():
    tree = shader_tree()
    a = tree.nodes.new("ShaderNodeRGB")
    b = tree.nodes.new("ShaderNodeBsdfPrincipled")
    a.select = True
    b.select = True
    p1 = capture_nodes(tree, [a, b], tree_type="ShaderNodeTree")
    p2 = capture_nodes(tree, [a, b], tree_type="ShaderNodeTree")
    assert _strip_copied_at(p1) == _strip_copied_at(p2)
    return "stable minus copied_at"


def test_group_second_tree():
    group = bpy.data.node_groups.new("_nv_grp", "ShaderNodeTree")
    group.interface.new_socket("Scale", in_out="INPUT", socket_type="NodeSocketFloat")
    group.interface.new_socket("Fac", in_out="OUTPUT", socket_type="NodeSocketFloat")
    inner = group.nodes.new("ShaderNodeTexNoise")
    inner.select = True
    tree = shader_tree()
    inst = tree.nodes.new("ShaderNodeGroup")
    inst.node_tree = group
    inst.select = True
    payload = capture_nodes(tree, [inst], tree_type="ShaderNodeTree")
    assert len(payload["trees"]) == 2
    g = payload["trees"][1]
    assert g["id"].startswith("group:")
    names = [i["name"] for i in g["interface"] if i.get("item_type") != "PANEL"]
    assert "Scale" in names and "Fac" in names
    ins = [i["in_out"] for i in g["interface"] if i.get("in_out")]
    assert "INPUT" in ins and "OUTPUT" in ins
    return "group tree + interface"


def test_geometry_two_nodes():
    tree = geo_tree()
    a = tree.nodes.new("GeometryNodeMeshCube")
    b = tree.nodes.new("GeometryNodeTransform")
    tree.links.new(a.outputs[0], b.inputs[0])
    a.select = True
    b.select = True
    payload = capture_nodes(tree, [a, b], tree_type="GeometryNodeTree")
    parse_clipboard_text(canonical_json(payload))
    assert payload["tree_type"] == "GeometryNodeTree"
    assert len(payload["trees"][0]["links"]) == 1
    return "geometry two-node link"


def test_compositor_two_nodes():
    tree = bpy.data.node_groups.new("_nv_comp", "CompositorNodeTree")
    a = tree.nodes.new("CompositorNodeRGB")
    b = tree.nodes.new("CompositorNodeAlphaOver")
    a.select = True
    b.select = True
    payload = capture_nodes(tree, [a, b], tree_type="CompositorNodeTree")
    parse_clipboard_text(canonical_json(payload))
    assert payload["tree_type"] == "CompositorNodeTree"
    assert len(payload["trees"][0]["nodes"]) == 2
    return "compositor two-node"


def test_register():
    from addon import register, unregister

    register()
    assert hasattr(bpy.types, "NODEVAULT_OT_copy_nodes")
    assert hasattr(bpy.types, "NODEVAULT_PT_panel")
    unregister()
    return "register/unregister"


TESTS = [
    test_two_linked_shader,
    test_unselected_link_dropped,
    test_frame_parent,
    test_ramp_three_stops,
    test_stable_except_copied_at,
    test_group_second_tree,
    test_geometry_two_nodes,
    test_compositor_two_nodes,
    test_register,
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
    print(f"blender_capture {len(TESTS) - failed}/{len(TESTS)} passed  blender={bpy.app.version_string}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
