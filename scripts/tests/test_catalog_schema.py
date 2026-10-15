"""Catalog schema helpers. Stdlib only; no bpy."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.catalog_schema import (
    COLOR_TAG_TO_THEME,
    catalog_json,
    header_color_key,
    is_denied_property,
    parse_draw_menu_paths,
    parse_menu_contents_ids,
    parse_node_types_from_source,
    parse_tree_type_add_menus,
    parse_zone_calls,
    parse_zone_pairs_from_assignments,
    version_dirname,
    widget_id,
    without_extracted_at,
)

SHADER_DRAW = """
    def draw(self, context):
        layout = self.layout
        self.node_operator(layout, "ShaderNodeAmbientOcclusion")
        self.node_operator_with_outputs(
            context, layout, "ShaderNodeCameraData",
            ["View Vector", "View Z Depth"],
        )
        self.node_operator_with_searchable_enum(context, layout, "ShaderNodeMath", "operation")
        self.draw_menu(layout, "Utilities")
        self.draw_menu(layout, path="Curve/Read")
        self.draw_assets_for_catalog(layout, self.bl_label)
"""

ADD_DRAW = """
        if snode.tree_type == 'GeometryNodeTree':
            layout.menu_contents("NODE_MT_geometry_node_add_all")
        elif snode.tree_type == 'CompositorNodeTree':
            layout.menu_contents("NODE_MT_compositor_node_add_all")
        elif snode.tree_type == 'ShaderNodeTree':
            layout.menu_contents("NODE_MT_shader_node_add_all")
"""

ZONE_DRAW = """
        self.repeat_zone(layout, "Repeat")
        self.simulation_zone(layout, "Simulation")
"""

ZONE_ASSIGN = """
        props.input_node_type = "GeometryNodeSimulationInput"
        props.output_node_type = "GeometryNodeSimulationOutput"
        props.input_node_type = "GeometryNodeRepeatInput"
        props.output_node_type = "GeometryNodeRepeatOutput"
"""


class ParseSourceTests(unittest.TestCase):
    def test_node_operator_variants(self):
        self.assertEqual(
            parse_node_types_from_source(SHADER_DRAW),
            ["ShaderNodeAmbientOcclusion", "ShaderNodeCameraData", "ShaderNodeMath"],
        )

    def test_draw_menu_paths(self):
        self.assertEqual(parse_draw_menu_paths(SHADER_DRAW), ["Utilities", "Curve/Read"])

    def test_add_all_roots(self):
        self.assertEqual(
            parse_tree_type_add_menus(ADD_DRAW),
            {
                "GeometryNodeTree": "NODE_MT_geometry_node_add_all",
                "CompositorNodeTree": "NODE_MT_compositor_node_add_all",
                "ShaderNodeTree": "NODE_MT_shader_node_add_all",
            },
        )
        self.assertEqual(parse_menu_contents_ids(ADD_DRAW)[0], "NODE_MT_geometry_node_add_all")

    def test_zone_helpers(self):
        self.assertEqual(
            parse_zone_calls(ZONE_DRAW),
            [
                ("GeometryNodeRepeatInput", "GeometryNodeRepeatOutput"),
                ("GeometryNodeSimulationInput", "GeometryNodeSimulationOutput"),
            ],
        )
        self.assertEqual(
            parse_zone_pairs_from_assignments(ZONE_ASSIGN)[:2],
            [
                ("GeometryNodeSimulationInput", "GeometryNodeSimulationOutput"),
                ("GeometryNodeRepeatInput", "GeometryNodeRepeatOutput"),
            ],
        )


class HeaderAndWidgetTests(unittest.TestCase):
    def test_color_tag_maps_to_theme(self):
        keys = set(COLOR_TAG_TO_THEME.values()) | {"frame_node", "layout_node"}
        self.assertEqual(
            header_color_key(
                color_tag="SHADER",
                rna_bases=["ShaderNodeBsdfPrincipled", "ShaderNode", "Node"],
                bl_idname="ShaderNodeBsdfPrincipled",
                theme_keys=keys,
            ),
            "shader_node",
        )

    def test_frame_prefers_frame_node(self):
        self.assertEqual(
            header_color_key(
                color_tag="NONE",
                rna_bases=["NodeFrame", "Node"],
                bl_idname="NodeFrame",
                theme_keys=["frame_node", "layout_node"],
            ),
            "frame_node",
        )

    def test_missing_theme_key_falls_back(self):
        self.assertEqual(
            header_color_key(
                color_tag="SHADER",
                rna_bases=["ShaderNode"],
                bl_idname="ShaderNodeBsdfPrincipled",
                theme_keys=["layout_node"],
            ),
            "layout_node",
        )

    def test_widget_order(self):
        self.assertEqual(widget_id(bl_idname="NodeFrame", has_color_ramp=True, has_curve_mapping=False, has_image=False, is_zone=False), "frame")
        self.assertEqual(widget_id(bl_idname="NodeReroute", has_color_ramp=False, has_curve_mapping=False, has_image=False, is_zone=False), "reroute")
        self.assertEqual(widget_id(bl_idname="ShaderNodeGroup", has_color_ramp=False, has_curve_mapping=False, has_image=False, is_zone=False), "group")
        self.assertEqual(widget_id(bl_idname="GeometryNodeRepeatInput", has_color_ramp=False, has_curve_mapping=False, has_image=False, is_zone=True), "zone")
        self.assertEqual(widget_id(bl_idname="ShaderNodeValToRGB", has_color_ramp=True, has_curve_mapping=False, has_image=False, is_zone=False), "color_ramp")
        self.assertEqual(widget_id(bl_idname="ShaderNodeRGBCurve", has_color_ramp=False, has_curve_mapping=True, has_image=False, is_zone=False), "curve_mapping")
        self.assertEqual(widget_id(bl_idname="ShaderNodeTexImage", has_color_ramp=False, has_curve_mapping=False, has_image=True, is_zone=False), "image")
        self.assertEqual(widget_id(bl_idname="ShaderNodeMath", has_color_ramp=False, has_curve_mapping=False, has_image=False, is_zone=False), "generic")

    def test_denylist(self):
        self.assertTrue(is_denied_property("location"))
        self.assertTrue(is_denied_property("bl_label"))
        self.assertTrue(is_denied_property("_internal"))
        self.assertFalse(is_denied_property("operation"))


class CanonicalCatalogTests(unittest.TestCase):
    def test_nodes_sorted_and_extracted_at_stripped(self):
        catalog = {
            "blender_version": [5, 1, 0],
            "blender_version_string": "5.1.0",
            "extracted_at": "2026-10-15T18:00:00Z",
            "theme_source": "factory",
            "themes": {"shader_node": [0.1, 0.2, 0.3], "grid": [0.2, 0.2, 0.2]},
            "socket_colors": {"NodeSocketFloat": [0.63, 0.63, 0.63]},
            "socket_colors_unresolved": [],
            "categories": [
                {
                    "tree_type": "ShaderNodeTree",
                    "id": "NODE_MT_category_shader_shader",
                    "label": "Shader",
                    "nodes": ["ShaderNodeBsdfPrincipled"],
                }
            ],
            "nodes": {
                "ShaderNodeMath": {
                    "bl_idname": "ShaderNodeMath",
                    "label": "Math",
                    "description": "",
                    "tree_types": ["ShaderNodeTree"],
                    "category_id": "NODE_MT_category_shader_math",
                    "header_color": "converter_node",
                    "width_default": 140,
                    "inputs": [],
                    "outputs": [],
                    "properties": [
                        {
                            "identifier": "operation",
                            "type": "ENUM",
                            "default": "ADD",
                            "enum_items": [{"identifier": "ADD", "name": "Add"}],
                            "affects_sockets": True,
                        }
                    ],
                    "widget": "generic",
                },
                "AaaFirst": {
                    "bl_idname": "AaaFirst",
                    "label": "A",
                    "description": "",
                    "tree_types": ["ShaderNodeTree"],
                    "category_id": "UNCATEGORIZED",
                    "header_color": "layout_node",
                    "width_default": 140,
                    "inputs": [],
                    "outputs": [],
                    "properties": [],
                    "widget": "generic",
                },
            },
            "skipped": [],
        }
        text = catalog_json(catalog)
        parsed = json.loads(text)
        self.assertEqual(list(parsed["nodes"]), ["AaaFirst", "ShaderNodeMath"])
        self.assertEqual(list(parsed["themes"]), ["grid", "shader_node"])
        self.assertTrue(text.endswith("}\n"))
        a = catalog_json({**catalog, "extracted_at": "2026-01-01T00:00:00Z"})
        b = catalog_json({**catalog, "extracted_at": "2026-12-31T23:59:59Z"})
        self.assertNotEqual(a, b)
        self.assertEqual(without_extracted_at(a), without_extracted_at(b))

    def test_version_dirname(self):
        self.assertEqual(version_dirname("5.1.0"), "5.1.0")
        self.assertEqual(version_dirname("5.2.0 Alpha"), "5.2.0_Alpha")


class ExtractedCatalogAcceptanceTests(unittest.TestCase):
    """Run against a catalog produced by the extractor. Skip if none is present."""

    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[2] / "catalog" / "versions"
        cls.catalogs = []
        if root.is_dir():
            for path in sorted(root.glob("*/catalog.json")):
                cls.catalogs.append(json.loads(path.read_text(encoding="utf-8")))

    def test_extracted_catalog_meets_pid_acceptance(self):
        if not self.catalogs:
            self.skipTest("no catalog/versions/*/catalog.json yet")
        for catalog in self.catalogs:
            with self.subTest(version=catalog.get("blender_version_string")):
                nodes = catalog["nodes"]
                self.assertTrue(catalog["themes"], "themes must be non-empty")
                self.assertTrue(nodes, "nodes must be non-empty")
                present = {tt for rec in nodes.values() for tt in rec["tree_types"]}
                for tree_type in ("ShaderNodeTree", "GeometryNodeTree", "CompositorNodeTree"):
                    self.assertIn(tree_type, present, f"no nodes for {tree_type}")

                principled = nodes.get("ShaderNodeBsdfPrincipled")
                if principled is None:
                    principled = next(
                        (n for n in nodes.values() if "Principled" in n.get("label", "") and "ShaderNodeTree" in n["tree_types"]),
                        None,
                    )
                self.assertIsNotNone(principled, "missing Principled BSDF or successor")
                assert principled is not None
                self.assertEqual(principled["header_color"], "shader_node")
                self.assertGreater(len(principled["inputs"]), 1)

                switch = nodes.get("GeometryNodeSwitch")
                math = nodes.get("ShaderNodeMath")
                flagged = False
                for rec in (switch, math):
                    if rec is None:
                        continue
                    if any(p.get("affects_sockets") for p in rec.get("properties") or []):
                        flagged = True
                self.assertTrue(flagged, "expected Switch or Math to flag affects_sockets")


if __name__ == "__main__":
    unittest.main()
