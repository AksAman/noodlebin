/**
 * Clipboard text to payload.
 *
 * The clipboard holds one JSON object and nothing else. There is no magic
 * line; the object identifies itself through `format` and `format_version`.
 *
 * Recognition: text whose trimmed form starts with `{` and contains the
 * format string is treated as an attempt at a NodeVault payload. Anything
 * else is "not a node tree" and is never parsed. Text that passes the check
 * but fails to parse is reported as broken JSON so a truncated paste gets a
 * useful message.
 */

import { NodeVaultError } from "./errors";
import { FORMAT } from "./types";
import type { NodeVaultPayload } from "./types";
import { validatePayload } from "./validate";

const NOT_A_TREE = "Clipboard is not a NodeVault node tree.";

/** Strip a UTF-8 byte order mark and surrounding whitespace. */
function normalize(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

/** True when `text` looks like something this parser should try to read. */
export function looksLikeNodeVault(text: string): boolean {
  const body = normalize(text);
  return body.startsWith("{") && body.includes(FORMAT);
}

/**
 * Parse clipboard or file text into a validated payload. Throws `NodeVaultError`.
 *
 * Returns the parsed object as it was, with unknown keys kept. Pass it to
 * `canonicalJson` to write it back out.
 */
export function parseNodeVaultText(text: string): NodeVaultPayload {
  const body = normalize(text);

  if (!looksLikeNodeVault(body)) {
    throw new NodeVaultError("not_nodevault", NOT_A_TREE);
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new NodeVaultError(
      "bad_json",
      `The clipboard looks like a NodeVault node tree but is not valid JSON: ${detail}`,
    );
  }

  const format =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)["format"]
      : undefined;
  if (format !== FORMAT) {
    throw new NodeVaultError("not_nodevault", NOT_A_TREE);
  }

  validatePayload(value);
  return value;
}

export type ParseResult =
  | { ok: true; payload: NodeVaultPayload }
  | { ok: false; error: NodeVaultError };

/** `parseNodeVaultText` without throwing. Non-NodeVault errors are rethrown. */
export function safeParseNodeVaultText(text: string): ParseResult {
  try {
    return { ok: true, payload: parseNodeVaultText(text) };
  } catch (err) {
    if (err instanceof NodeVaultError) return { ok: false, error: err };
    throw err;
  }
}
