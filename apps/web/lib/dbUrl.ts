const ALIASES_OF_VERIFY_FULL = new Set(["prefer", "require", "verify-ca"])

/**
 * pg-connection-string treats sslmode=prefer, require, and verify-ca as verify-full today and
 * warns that v3 will switch to libpq semantics. Say verify-full outright so behaviour stays the
 * same and the warning goes away. A URL that opts into libpq semantics is left alone.
 */
export function normalizeDatabaseUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (parsed.searchParams.has("uselibpqcompat")) return url
  const mode = parsed.searchParams.get("sslmode")
  if (!mode || !ALIASES_OF_VERIFY_FULL.has(mode)) return url
  parsed.searchParams.set("sslmode", "verify-full")
  return parsed.toString()
}
