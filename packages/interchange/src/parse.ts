/**
 * Clipboard text to payload.
 *
 * The clipboard holds one JSON object and nothing else. There is no magic
 * line; the object identifies itself through `format` and `format_version`.
 *
 * Recognition: text whose trimmed form starts with `{` and contains the
 * format string is treated as an attempt at a NoodleBin payload. Anything
 * else is "not a node tree" and is never parsed. Text that passes the check
 * but fails to parse is reported as broken JSON so a truncated paste gets a
 * useful message.
 */

import { NoodleBinError } from "./errors";
import { FORMAT } from "./types";
import type { NoodleBinPayload } from "./types";
import { validatePayload } from "./validate";

const NOT_A_TREE = "Clipboard is not a NoodleBin node tree.";

/** Strip a UTF-8 byte order mark and surrounding whitespace. */
function normalize(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

/** True when `text` looks like something this parser should try to read. */
export function looksLikeNoodleBin(text: string): boolean {
  const body = normalize(text);
  return body.startsWith("{") && body.includes(FORMAT);
}

/**
 * Parse clipboard or file text into a validated payload. Throws `NoodleBinError`.
 *
 * Returns the parsed object as it was, with unknown keys kept. Pass it to
 * `canonicalJson` to write it back out.
 */
export function parseNoodleBinText(text: string): NoodleBinPayload {
  const body = normalize(text);

  if (!looksLikeNoodleBin(body)) {
    throw new NoodleBinError("not_noodlebin", NOT_A_TREE);
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new NoodleBinError(
      "bad_json",
      `The clipboard looks like a NoodleBin node tree but is not valid JSON: ${detail}`,
    );
  }

  const format =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)["format"]
      : undefined;
  if (format !== FORMAT) {
    throw new NoodleBinError("not_noodlebin", NOT_A_TREE);
  }

  validatePayload(value);
  return value;
}

export type ParseResult =
  | { ok: true; payload: NoodleBinPayload }
  | { ok: false; error: NoodleBinError };

/** `parseNoodleBinText` without throwing. Non-NoodleBin errors are rethrown. */
export function safeParseNoodleBinText(text: string): ParseResult {
  try {
    return { ok: true, payload: parseNoodleBinText(text) };
  } catch (err) {
    if (err instanceof NoodleBinError) return { ok: false, error: err };
    throw err;
  }
}
