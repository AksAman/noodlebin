/** Absolute origin for metadata. Relative Open Graph paths are resolved against this. */
export function siteOrigin(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (host) return `https://${host}`
  return "http://localhost:5173"
}
