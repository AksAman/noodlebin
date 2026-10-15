/**
 * The clipboard envelope: a magic line, then one JSON object.
 *
 *   nodevault 1
 *   { ...json... }
 *
 * Line 1 is exactly `nodevault 1`. A `\r\n` line ending is tolerated because
 * some clipboards rewrite newlines. A missing trailing newline is accepted.
 * A different magic (`nodevault 2`, ...) is rejected until a migration exists.
 *
 * Bare JSON whose `format` is `nodevault.tree` is accepted without the magic
 * line (paste-in-browser PID, step 3). It is still written back with the
 * magic line on the way out.
 */

import { NodeVaultError } from "./errors";
import { FORMAT, MAGIC } from "./types";
import type { NodeVaultPayload } from "./types";
import { validatePayload } from "./validate";

const MAGIC_PREFIX = "nodevault ";

export interface Envelope {
  /** True when the text began with a `nodevault N` line. */
  hasMagic: boolean;
  /** The magic line as found, without its newline. Undefined for bare JSON. */
  magic: string | undefined;
  /** The JSON text after the magic line (or the whole text). */
  json: string;
}

/** Split the magic line from the JSON. Does not parse the JSON. */
export function splitEnvelope(text: string): Envelope {
  if (!text.startsWith(MAGIC_PREFIX)) {
    return { hasMagic: false, magic: undefined, json: text };
  }
  const newline = text.indexOf("\n");
  const firstLine = (newline === -1 ? text : text.slice(0, newline)).replace(
    /\r$/,
    "",
  );
  const json = newline === -1 ? "" : text.slice(newline + 1);
  return { hasMagic: true, magic: firstLine, json };
}

/** True when `text` looks like something this parser should try to read. */
export function looksLikeNodeVault(text: string): boolean {
  if (text.startsWith(MAGIC_PREFIX)) return true;
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") && trimmed.includes(FORMAT);
}

/**
 * Parse clipboard text into a validated payload. Throws `NodeVaultError`.
 *
 * Returns the parsed object as it was, with unknown keys kept. Pass it to
 * `canonicalText` to write it back out.
 */
export function parseNodeVaultText(text: string): NodeVaultPayload {
  const envelope = splitEnvelope(text);

  if (envelope.hasMagic && envelope.magic !== MAGIC) {
    throw new NodeVaultError(
      "bad_magic",
      `Unsupported NodeVault format line "${envelope.magic}". This build reads "${MAGIC}".`,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(envelope.json);
  } catch (err) {
    if (envelope.hasMagic) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new NodeVaultError(
        "bad_json",
        `The text after "${MAGIC}" is not valid JSON: ${detail}`,
      );
    }
    throw new NodeVaultError(
      "not_nodevault",
      "Clipboard is not a NodeVault node tree.",
    );
  }

  if (!envelope.hasMagic) {
    const format =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)["format"]
        : undefined;
    if (format !== FORMAT) {
      throw new NodeVaultError(
        "not_nodevault",
        "Clipboard is not a NodeVault node tree.",
      );
    }
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
