"""Interchange-format tests for the add-on side. Stdlib only; no bpy.

Run from v2/:  python3 -m unittest discover -s addon/tests -t . -v
"""

from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from addon import deserialize, serialize
from addon.deserialize import (
    NoodleBinError,
    parse_clipboard_text,
    validate_payload,
)
from addon.serialize import (
    canonical_json,
    canonicalize,
    format_number,
)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "handwritten"
    / "worked-example-shader.noodlebin.json"
)
FIXTURE_TEXT = FIXTURE_PATH.read_text(encoding="utf-8")


def fixture() -> dict:
    return parse_clipboard_text(FIXTURE_TEXT)


def parse_object(obj) -> dict:
    return parse_clipboard_text(json.dumps(obj))


class ErrorAssertions(unittest.TestCase):
    def assert_error(
        self, fn, code: str, message_part: str | None = None
    ) -> NoodleBinError:
        with self.assertRaises(NoodleBinError) as ctx:
            fn()
        self.assertEqual(ctx.exception.code, code)
        if message_part:
            self.assertIn(message_part, str(ctx.exception))
        return ctx.exception


class TextTests(ErrorAssertions):
    def test_fixture_is_plain_json(self):
        json.loads(FIXTURE_TEXT)  # must not raise

    def test_crlf_tolerated(self):
        text = FIXTURE_TEXT.replace("\n", "\r\n")
        self.assertEqual(parse_clipboard_text(text)["origin"]["node_count"], 2)

    def test_whitespace_and_bom_tolerated(self):
        self.assertEqual(len(parse_clipboard_text(f"\n\n  {FIXTURE_TEXT}  \n")["trees"]), 1)
        self.assertEqual(len(parse_clipboard_text(f"\ufeff{FIXTURE_TEXT}")["trees"]), 1)

    def test_missing_trailing_newline(self):
        self.assertEqual(len(parse_clipboard_text(FIXTURE_TEXT.rstrip())["trees"]), 1)

    def test_legacy_magic_line_not_accepted(self):
        self.assert_error(
            lambda: parse_clipboard_text(f"noodlebin 1\n{FIXTURE_TEXT}"), "not_noodlebin"
        )

    def test_plain_text(self):
        self.assert_error(
            lambda: parse_clipboard_text("hello world"),
            "not_noodlebin",
            "Clipboard is not a noodlebin node tree",
        )

    def test_bare_json_other_format(self):
        self.assert_error(
            lambda: parse_clipboard_text('{"format": "something.else"}'),
            "not_noodlebin",
        )
        self.assert_error(lambda: parse_clipboard_text("[1, 2, 3]"), "not_noodlebin")

    def test_bad_json_when_clearly_meant_as_a_tree(self):
        truncated = FIXTURE_TEXT[: len(FIXTURE_TEXT) // 2]
        self.assert_error(lambda: parse_clipboard_text(truncated), "bad_json", "not valid JSON")
        # Broken JSON that never mentions the format is just not a node tree.
        self.assert_error(lambda: parse_clipboard_text("{ not json"), "not_noodlebin")

    def test_looks_like(self):
        self.assertTrue(deserialize.looks_like_noodlebin(FIXTURE_TEXT))
        self.assertTrue(deserialize.looks_like_noodlebin(f"  \ufeff{FIXTURE_TEXT}"))
        self.assertFalse(deserialize.looks_like_noodlebin("some text"))
        self.assertFalse(deserialize.looks_like_noodlebin('{"a": 1}'))


class ValidationTests(ErrorAssertions):
    def test_worked_example(self):
        p = fixture()
        self.assertEqual(p["format"], "noodlebin.tree")
        self.assertEqual(p["blender_version"], [5, 0, 1])
        self.assertEqual(
            [n["bl_idname"] for n in p["trees"][0]["nodes"]],
            ["ShaderNodeTexNoise", "ShaderNodeBsdfPrincipled"],
        )

    def test_bad_format(self):
        p = fixture()
        p["format"] = "noodlebin.other"
        # At the text boundary a foreign format is simply not a node tree.
        self.assert_error(lambda: parse_object(p), "not_noodlebin")
        # The validator itself names the field.
        self.assert_error(lambda: validate_payload(p), "bad_format", "noodlebin.other")

    def test_format_version_99(self):
        p = fixture()
        p["format_version"] = 99
        self.assert_error(lambda: parse_object(p), "bad_format_version", "99")

    def test_format_version_true_is_not_1(self):
        p = fixture()
        p["format_version"] = True
        self.assert_error(lambda: parse_object(p), "bad_format_version")

    def test_bad_tree_type(self):
        p = fixture()
        p["tree_type"] = "TextureNodeTree"
        self.assert_error(lambda: parse_object(p), "bad_tree_type", "TextureNodeTree")

    def test_bad_blender_version(self):
        for bad in (
            [5, 0],
            [5, 0, -1],
            [5, 0, 1.5],
            "5.0.1",
            [5, 0, 1, 0],
            [True, 0, 1],
        ):
            p = fixture()
            p["blender_version"] = bad
            self.assert_error(lambda: parse_object(p), "bad_blender_version")

    def test_root_rules(self):
        p = fixture()
        p["trees"][0]["is_root"] = False
        self.assert_error(lambda: parse_object(p), "bad_root")

        p = fixture()
        p["trees"][0]["id"] = "main"
        self.assert_error(lambda: parse_object(p), "bad_root")

        p = fixture()
        second = copy.deepcopy(p["trees"][0])
        second["id"] = "root2"
        p["trees"].append(second)
        self.assert_error(lambda: parse_object(p), "bad_root")

    def test_duplicate_tree_id(self):
        p = fixture()
        second = copy.deepcopy(p["trees"][0])
        second["is_root"] = False
        p["trees"].append(second)
        self.assert_error(lambda: parse_object(p), "duplicate_tree_id")

    def test_duplicate_node_id(self):
        p = fixture()
        p["trees"][0]["nodes"][1]["id"] = "n1"
        self.assert_error(lambda: parse_object(p), "duplicate_node_id", '"n1"')

    def test_dangling_parent(self):
        p = fixture()
        p["trees"][0]["nodes"][0]["parent_id"] = "n99"
        self.assert_error(lambda: parse_object(p), "dangling_parent", '"n99"')

    def test_dangling_zone_pair(self):
        p = fixture()
        p["trees"][0]["nodes"][0]["zone_pair_id"] = "n42"
        self.assert_error(lambda: parse_object(p), "dangling_zone_pair", '"n42"')

    def test_group_tree_id(self):
        p = fixture()
        p["trees"][0]["nodes"][0]["group_tree_id"] = "group:Thing"
        self.assert_error(lambda: parse_object(p), "dangling_group", '"group:Thing"')

        p["trees"].append(
            {
                "id": "group:Thing",
                "name": "Thing",
                "is_root": False,
                "interface": [],
                "nodes": [],
                "links": [],
            }
        )
        self.assertEqual(len(parse_object(p)["trees"]), 2)

        p["trees"][0]["nodes"][0]["group_tree_id"] = "root"
        self.assert_error(lambda: parse_object(p), "dangling_group")

    def test_dangling_link_node(self):
        p = fixture()
        p["trees"][0]["links"][0]["to_node"] = "n7"
        self.assert_error(lambda: parse_object(p), "dangling_link_node", '"n7"')

    def test_dangling_link_socket(self):
        p = fixture()
        p["trees"][0]["links"][0]["to_socket"]["identifier"] = "Metallic"
        self.assert_error(lambda: parse_object(p), "dangling_link_socket", '"Metallic"')

        p = fixture()
        p["trees"][0]["links"][0]["from_socket"]["identifier"] = "Color"
        self.assert_error(lambda: parse_object(p), "dangling_link_socket", '"Color"')

        # An input used as a link source is dangling.
        p = fixture()
        p["trees"][0]["links"][0]["from_socket"]["identifier"] = "Scale"
        self.assert_error(lambda: parse_object(p), "dangling_link_socket")

    def test_malformed_has_path(self):
        p = fixture()
        p["trees"] = "not an array"
        err = self.assert_error(lambda: parse_object(p), "malformed")
        self.assertEqual(err.path, "$.trees")

        p = fixture()
        del p["origin"]
        self.assert_error(lambda: parse_object(p), "malformed", "$.origin")

    def test_validate_parsed_object(self):
        value = json.loads(FIXTURE_TEXT)
        validate_payload(value)
        self.assertTrue(deserialize.is_valid_payload(value))
        self.assertFalse(deserialize.is_valid_payload({}))


class CanonicalTests(unittest.TestCase):
    def test_fixture_round_trips_byte_for_byte(self):
        self.assertEqual(canonical_json(fixture()), FIXTURE_TEXT)

    def test_canonical_json_shape(self):
        text = canonical_json(fixture())
        self.assertTrue(text.startswith("{\n"))
        self.assertTrue(text.endswith("}\n"))
        self.assertEqual(json.loads(text), fixture())

    def test_scrambled_key_order_restored(self):
        def reverse_keys(value):
            if isinstance(value, dict):
                return {k: reverse_keys(value[k]) for k in reversed(list(value))}
            if isinstance(value, list):
                return [reverse_keys(v) for v in value]
            return value

        scrambled = reverse_keys(fixture())
        self.assertNotEqual(json.dumps(scrambled), json.dumps(fixture()))
        self.assertEqual(canonical_json(scrambled), FIXTURE_TEXT)

    def test_unknown_keys_preserved_after_known(self):
        p = fixture()
        p["x_future_field"] = {"nested": [1, 2, 3]}
        node = p["trees"][0]["nodes"][0]
        node["x_node_extra"] = "kept"
        node["sockets"]["inputs"][0]["x_socket_extra"] = True

        reparsed = parse_clipboard_text(canonical_json(p))
        self.assertEqual(reparsed["x_future_field"], {"nested": [1, 2, 3]})

        out = canonicalize(p)
        top_keys = list(out)
        self.assertEqual(top_keys[-1], "x_future_field")
        self.assertEqual(top_keys[:8], list(serialize.PAYLOAD_KEYS))

        node_keys = list(out["trees"][0]["nodes"][0])
        self.assertEqual(node_keys[-1], "x_node_extra")
        self.assertLess(
            node_keys.index("zone_pair_id"), node_keys.index("x_node_extra")
        )

        socket_keys = list(out["trees"][0]["nodes"][0]["sockets"]["inputs"][0])
        self.assertEqual(socket_keys[-1], "x_socket_extra")

    def test_properties_and_widgets_keep_order(self):
        p = fixture()
        node = p["trees"][0]["nodes"][0]
        node["properties"] = {
            "noise_dimensions": "3D",
            "normalize": True,
            "noise_type": "FBM",
        }
        node["widgets"] = {
            "color_ramp": {
                "interpolation": "LINEAR",
                "color_mode": "RGB",
                "hue_interpolation": "NEAR",
                "elements": [],
            }
        }
        out = canonicalize(p)["trees"][0]["nodes"][0]
        self.assertEqual(
            list(out["properties"]), ["noise_dimensions", "normalize", "noise_type"]
        )
        self.assertEqual(
            list(out["widgets"]["color_ramp"]),
            ["interpolation", "color_mode", "hue_interpolation", "elements"],
        )

    def test_frame_extras_in_canonical_slots(self):
        p = fixture()
        frame = copy.deepcopy(p["trees"][0]["nodes"][0])
        frame.update(
            id="n3",
            bl_idname="NodeFrame",
            text="notes",
            shrink=True,
            label_size=20,
            height=300,
        )
        p["trees"][0]["nodes"].append(frame)
        keys = list(canonicalize(p)["trees"][0]["nodes"][2])
        self.assertEqual(keys.index("width"), keys.index("height") - 1)
        self.assertEqual(keys[-3:], ["label_size", "shrink", "text"])

    def test_canonicalize_is_pure(self):
        original = fixture()
        before = json.dumps(original)
        out = canonicalize(original)
        self.assertEqual(json.dumps(original), before)
        self.assertIsNot(out, original)
        self.assertEqual(out, original)
        self.assertEqual(parse_clipboard_text(canonical_json(original)), original)

    def test_numbers_match_javascript(self):
        # (python value, JSON.stringify output)
        cases = [
            (0, "0"),
            (0.0, "0"),
            (-0.0, "0"),
            (5, "5"),
            (5.0, "5"),
            (-300.0, "-300"),
            (0.5, "0.5"),
            (140.0, "140"),
            (0.1, "0.1"),
            (0.000001, "0.000001"),
            (0.0000001, "1e-7"),
            (0.00000123, "0.00000123"),
            (1.5e-7, "1.5e-7"),
            (123456789012345680000.0, "123456789012345680000"),
            (1e21, "1e+21"),
            (1.5e21, "1.5e+21"),
            (1e16, "10000000000000000"),
            (123.456, "123.456"),
            (-2.5, "-2.5"),
            (0.30000000000000004, "0.30000000000000004"),
            (1.7976931348623157e308, "1.7976931348623157e+308"),
            (5e-324, "5e-324"),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(format_number(value), expected)

    def test_non_finite_rejected(self):
        for bad in (float("nan"), float("inf"), float("-inf")):
            with self.assertRaises(ValueError):
                format_number(bad)

    def test_string_escapes_match_javascript(self):
        text = serialize.dumps_pretty({"k": 'a"b\\c\nd\te\x01 é 日本 \u2028'})
        self.assertEqual(text, '{\n  "k": "a\\"b\\\\c\\nd\\te\\u0001 é 日本 \u2028"\n}')

    def test_empty_containers(self):
        self.assertEqual(serialize.dumps_pretty({}), "{}")
        self.assertEqual(serialize.dumps_pretty([]), "[]")
        self.assertEqual(
            serialize.dumps_pretty({"a": [], "b": {}}), '{\n  "a": [],\n  "b": {}\n}'
        )


if __name__ == "__main__":
    unittest.main()
