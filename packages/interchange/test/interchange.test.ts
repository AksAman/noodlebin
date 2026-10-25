import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  NoodleBinError,
  canonicalJson,
  canonicalize,
  looksLikeNoodleBin,
  parseNoodleBinText,
  safeParseNoodleBinText,
  validatePayload,
} from "../src/index";
import type { NoodleBinPayload } from "../src/index";

const FIXTURE_PATH = join(
  import.meta.dir,
  "../../../fixtures/handwritten/worked-example-shader.noodlebin.json",
);
const FIXTURE_TEXT = readFileSync(FIXTURE_PATH, "utf8");

/** A fresh deep copy of the parsed fixture so tests can mutate it. */
function fixture(): NoodleBinPayload {
  return parseNoodleBinText(FIXTURE_TEXT);
}

/** Parse a mutated payload object through the full text path. */
function parseObject(obj: unknown): NoodleBinPayload {
  return parseNoodleBinText(JSON.stringify(obj));
}

function expectError(
  fn: () => unknown,
  code: NoodleBinError["code"],
  messagePart?: string,
): NoodleBinError {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(NoodleBinError);
  const error = caught as NoodleBinError;
  expect(error.code).toBe(code);
  if (messagePart) expect(error.message).toContain(messagePart);
  return error;
}

describe("text", () => {
  test("the fixture is plain JSON that JSON.parse accepts on its own", () => {
    expect(() => JSON.parse(FIXTURE_TEXT)).not.toThrow();
  });

  test("tolerates CRLF line endings", () => {
    const text = FIXTURE_TEXT.replace(/\n/g, "\r\n");
    expect(parseNoodleBinText(text).origin.node_count).toBe(2);
  });

  test("tolerates surrounding whitespace and a BOM", () => {
    expect(parseNoodleBinText(`\n\n  ${FIXTURE_TEXT}  \n`).trees.length).toBe(1);
    expect(parseNoodleBinText(`\uFEFF${FIXTURE_TEXT}`).trees.length).toBe(1);
  });

  test("accepts a missing trailing newline", () => {
    expect(parseNoodleBinText(FIXTURE_TEXT.trimEnd()).trees.length).toBe(1);
  });

  test("a legacy magic line is not accepted", () => {
    expectError(
      () => parseNoodleBinText(`noodlebin 1\n${FIXTURE_TEXT}`),
      "not_noodlebin",
    );
  });

  test("rejects ordinary text", () => {
    expectError(
      () => parseNoodleBinText("hello world"),
      "not_noodlebin",
      "Clipboard is not a NoodleBin node tree",
    );
  });

  test("rejects bare JSON that is not a node tree", () => {
    expectError(
      () => parseNoodleBinText('{"format": "something.else"}'),
      "not_noodlebin",
    );
    expectError(() => parseNoodleBinText("[1, 2, 3]"), "not_noodlebin");
  });

  test("names broken JSON when the text was clearly meant to be a node tree", () => {
    const truncated = FIXTURE_TEXT.slice(0, FIXTURE_TEXT.length / 2);
    expectError(() => parseNoodleBinText(truncated), "bad_json", "not valid JSON");
    // Broken JSON that never mentions the format is just not a node tree.
    expectError(() => parseNoodleBinText("{ not json"), "not_noodlebin");
  });

  test("safeParse returns the error instead of throwing", () => {
    const result = safeParseNoodleBinText("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_noodlebin");
    const good = safeParseNoodleBinText(FIXTURE_TEXT);
    expect(good.ok).toBe(true);
  });

  test("looksLikeNoodleBin is a cheap pre-check", () => {
    expect(looksLikeNoodleBin(FIXTURE_TEXT)).toBe(true);
    expect(looksLikeNoodleBin(`  \uFEFF${FIXTURE_TEXT}`)).toBe(true);
    expect(looksLikeNoodleBin("some text")).toBe(false);
    expect(looksLikeNoodleBin('{"a": 1}')).toBe(false);
  });
});

describe("validation", () => {
  test("accepts the worked example", () => {
    const payload = fixture();
    expect(payload.format).toBe("noodlebin.tree");
    expect(payload.format_version).toBe(1);
    expect(payload.blender_version).toEqual([5, 0, 1]);
    expect(payload.trees[0]!.nodes.map((n) => n.bl_idname)).toEqual([
      "ShaderNodeTexNoise",
      "ShaderNodeBsdfPrincipled",
    ]);
    expect(payload.trees[0]!.links[0]!.from_socket.identifier).toBe("Fac");
  });

  test("rejects a wrong format string", () => {
    const p = fixture() as unknown as Record<string, unknown>;
    p["format"] = "noodlebin.other";
    // At the text boundary a foreign format is simply not a node tree.
    expectError(() => parseObject(p), "not_noodlebin");
    // The validator itself names the field.
    expectError(() => validatePayload(p), "bad_format", "noodlebin.other");
  });

  test("rejects format_version 99 with a version error", () => {
    const p = fixture() as unknown as Record<string, unknown>;
    p["format_version"] = 99;
    expectError(() => parseObject(p), "bad_format_version", "99");
  });

  test("rejects an unsupported tree type", () => {
    const p = fixture() as unknown as Record<string, unknown>;
    p["tree_type"] = "TextureNodeTree";
    expectError(() => parseObject(p), "bad_tree_type", "TextureNodeTree");
  });

  test("rejects a blender_version that is not three non-negative integers", () => {
    for (const bad of [
      [5, 0],
      [5, 0, -1],
      [5, 0, 1.5],
      "5.0.1",
      [5, 0, 1, 0],
    ]) {
      const p = fixture() as unknown as Record<string, unknown>;
      p["blender_version"] = bad;
      expectError(() => parseObject(p), "bad_blender_version");
    }
  });

  test("requires exactly one root tree with id root", () => {
    const noRoot = fixture();
    noRoot.trees[0]!.is_root = false;
    expectError(() => parseObject(noRoot), "bad_root");

    const wrongId = fixture();
    wrongId.trees[0]!.id = "main";
    expectError(() => parseObject(wrongId), "bad_root");

    const twoRoots = fixture();
    twoRoots.trees.push({
      ...structuredClone(twoRoots.trees[0]!),
      id: "root2",
    });
    expectError(() => parseObject(twoRoots), "bad_root");
  });

  test("rejects duplicate tree ids", () => {
    const p = fixture();
    p.trees.push({ ...structuredClone(p.trees[0]!), is_root: false });
    expectError(() => parseObject(p), "duplicate_tree_id");
  });

  test("rejects duplicate node ids inside a tree", () => {
    const p = fixture();
    p.trees[0]!.nodes[1]!.id = "n1";
    expectError(() => parseObject(p), "duplicate_node_id", '"n1"');
  });

  test("rejects a parent_id that is not in the tree", () => {
    const p = fixture();
    p.trees[0]!.nodes[0]!.parent_id = "n99";
    expectError(() => parseObject(p), "dangling_parent", '"n99"');
  });

  test("rejects a zone_pair_id that is not in the tree", () => {
    const p = fixture();
    p.trees[0]!.nodes[0]!.zone_pair_id = "n42";
    expectError(() => parseObject(p), "dangling_zone_pair", '"n42"');
  });

  test("accepts a group_tree_id that names another tree and rejects one that does not", () => {
    const p = fixture();
    p.trees[0]!.nodes[0]!.group_tree_id = "group:Thing";
    expectError(() => parseObject(p), "dangling_group", '"group:Thing"');

    p.trees.push({
      id: "group:Thing",
      name: "Thing",
      is_root: false,
      interface: [],
      nodes: [],
      links: [],
    });
    expect(parseObject(p).trees.length).toBe(2);

    // A group may not point at its own tree.
    p.trees[0]!.nodes[0]!.group_tree_id = "root";
    expectError(() => parseObject(p), "dangling_group");
  });

  test("rejects a link whose node is missing", () => {
    const p = fixture();
    p.trees[0]!.links[0]!.to_node = "n7";
    expectError(() => parseObject(p), "dangling_link_node", '"n7"');
  });

  test("rejects a link whose socket is missing on the node", () => {
    const p = fixture();
    p.trees[0]!.links[0]!.to_socket.identifier = "Metallic";
    expectError(() => parseObject(p), "dangling_link_socket", '"Metallic"');

    const q = fixture();
    q.trees[0]!.links[0]!.from_socket.identifier = "Color";
    expectError(() => parseObject(q), "dangling_link_socket", '"Color"');
  });

  test("a link from an input or to an output is dangling", () => {
    // Fac is an output of n1; Scale is an input. Swapping direction must fail.
    const p = fixture();
    p.trees[0]!.links[0]!.from_socket.identifier = "Scale";
    expectError(() => parseObject(p), "dangling_link_socket");
  });

  test("reports structural problems as malformed with a path", () => {
    const p = fixture() as unknown as Record<string, unknown>;
    p["trees"] = "not an array";
    const err = expectError(() => parseObject(p), "malformed");
    expect(err.path).toBe("$.trees");

    const q = fixture() as unknown as Record<string, unknown>;
    delete q["origin"];
    expectError(() => parseObject(q), "malformed", "$.origin");
  });

  test("validatePayload works on an already-parsed object", () => {
    const value: unknown = JSON.parse(FIXTURE_TEXT);
    validatePayload(value);
    expect(value.tree_type).toBe("ShaderNodeTree");
  });
});

describe("canonical serialization", () => {
  test("the fixture is already canonical: parse then serialize returns the same bytes", () => {
    expect(canonicalJson(fixture())).toBe(FIXTURE_TEXT);
  });

  test("canonicalJson is a bare object with a trailing newline", () => {
    const json = canonicalJson(fixture());
    expect(json.startsWith("{\n")).toBe(true);
    expect(json.endsWith("}\n")).toBe(true);
    expect(JSON.parse(json)).toEqual(fixture());
  });

  test("scrambled key order is restored", () => {
    const scrambled = JSON.parse(
      JSON.stringify(fixture(), (_key, value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const entries = Object.entries(
            value as Record<string, unknown>,
          ).reverse();
          return Object.fromEntries(entries);
        }
        return value;
      }),
    );
    expect(JSON.stringify(scrambled)).not.toBe(JSON.stringify(fixture()));
    expect(canonicalJson(scrambled)).toBe(FIXTURE_TEXT);
  });

  test("unknown keys survive and come after the known keys", () => {
    const p = fixture() as unknown as Record<string, unknown>;
    p["x_future_field"] = { nested: [1, 2, 3] };
    const node = (p["trees"] as Record<string, unknown>[])[0]![
      "nodes"
    ] as Record<string, unknown>[];
    node[0]!["x_node_extra"] = "kept";
    const socket = (node[0]!["sockets"] as Record<string, unknown[]>)[
      "inputs"
    ]![0] as Record<string, unknown>;
    socket["x_socket_extra"] = true;

    const text = canonicalJson(p);
    const reparsed = parseNoodleBinText(text) as unknown as Record<
      string,
      unknown
    >;
    expect(reparsed["x_future_field"]).toEqual({ nested: [1, 2, 3] });

    const topKeys = Object.keys(canonicalize(p));
    expect(topKeys[topKeys.length - 1]).toBe("x_future_field");
    expect(topKeys.slice(0, 8)).toEqual([
      "format",
      "format_version",
      "blender_version",
      "blender_version_string",
      "tree_type",
      "copied_at",
      "origin",
      "trees",
    ]);

    const canonicalNode = (
      canonicalize(p)["trees"] as Record<string, unknown>[]
    )[0]!["nodes"] as Record<string, unknown>[];
    const nodeKeys = Object.keys(canonicalNode[0]!);
    expect(nodeKeys[nodeKeys.length - 1]).toBe("x_node_extra");
    expect(nodeKeys.indexOf("zone_pair_id")).toBeLessThan(
      nodeKeys.indexOf("x_node_extra"),
    );

    const socketKeys = Object.keys(
      (canonicalNode[0]!["sockets"] as Record<string, unknown[]>)[
        "inputs"
      ]![0] as Record<string, unknown>,
    );
    expect(socketKeys[socketKeys.length - 1]).toBe("x_socket_extra");
  });

  test("properties and widgets keep Blender's reported key order", () => {
    const p = fixture();
    p.trees[0]!.nodes[0]!.properties = {
      noise_dimensions: "3D",
      normalize: true,
      noise_type: "FBM",
    };
    p.trees[0]!.nodes[0]!.widgets = {
      color_ramp: {
        interpolation: "LINEAR",
        color_mode: "RGB",
        hue_interpolation: "NEAR",
        elements: [],
      },
    };
    const out = canonicalize(p);
    expect(Object.keys(out.trees[0]!.nodes[0]!.properties)).toEqual([
      "noise_dimensions",
      "normalize",
      "noise_type",
    ]);
    expect(Object.keys(out.trees[0]!.nodes[0]!.widgets.color_ramp!)).toEqual([
      "interpolation",
      "color_mode",
      "hue_interpolation",
      "elements",
    ]);
  });

  test("frame extras and optional fields take their canonical slots", () => {
    const p = fixture();
    const frame = {
      ...structuredClone(p.trees[0]!.nodes[0]!),
      id: "n3",
      bl_idname: "NodeFrame",
      text: "notes",
      shrink: true,
      label_size: 20,
      height: 300,
    };
    p.trees[0]!.nodes.push(frame);
    const keys = Object.keys(canonicalize(p).trees[0]!.nodes[2]!);
    expect(keys.indexOf("width")).toBe(keys.indexOf("height") - 1);
    expect(keys.slice(-3)).toEqual(["label_size", "shrink", "text"]);
  });

  test("canonicalize does not mutate its input and preserves every value", () => {
    const original = fixture();
    const before = JSON.stringify(original);
    const out = canonicalize(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(out).not.toBe(original);
    expect(out).toEqual(original);
    // Round trip through text and back: values equal, key order ignored by toEqual.
    expect(parseNoodleBinText(canonicalJson(original))).toEqual(original);
  });

  test("numbers stay numbers", () => {
    const p = fixture();
    p.trees[0]!.nodes[0]!.sockets.inputs[0]!.default_value = 0.000001;
    p.trees[0]!.nodes[0]!.width = 1e21;
    const text = canonicalJson(p);
    expect(text).toContain('"default_value": 0.000001');
    expect(text).toContain('"width": 1e+21');
    const back = parseNoodleBinText(text);
    expect(back.trees[0]!.nodes[0]!.sockets.inputs[0]!.default_value).toBe(
      0.000001,
    );
  });
});
