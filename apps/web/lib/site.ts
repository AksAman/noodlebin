import { env } from "@/env";

/** Absolute origin for metadata. Relative Open Graph paths are resolved against this. */
export function siteOrigin(): string {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  if (host) return `https://${host}`;
  return env.NEXT_PUBLIC_BASE_URL;
}
