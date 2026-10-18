import { env } from "@/env";
import posthog from "posthog-js";

/** First-party path. Rewritten to PostHog in next.config.ts. */
export const POSTHOG_PROXY_PATH = "/api/v1";

/** Toolbar and other PostHog links. Not the ingest host. */
export const POSTHOG_UI_HOST = "https://us.posthog.com";

/** Page analytics stay off until a project key is set, and off inside embedded graphs. */
export function analyticsEnabled(pathname: string): boolean {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return false;
  return pathname !== "/embed" && !pathname.startsWith("/embed/");
}

export function posthogApiHost(): string {
  return env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_PROXY_PATH;
}

type CaptureValue = string | number | boolean;

/** No-ops when analytics is off. `immediate` flushes before a redirect unloads the page. */
export function capture(event: string, properties?: Record<string, CaptureValue>, immediate = false): void {
  if (typeof window === "undefined") return;
  if (!analyticsEnabled(window.location.pathname)) return;
  try {
    posthog.capture(event, properties, immediate ? { send_instantly: true } : undefined);
  } catch {
    // Analytics must not break the page when the script is blocked.
  }
}

/** Same shape Mave sends to posthog.identify: the email is the distinct id, and both email and em are person properties. */
export function personProperties(user: {
  email: string;
  name?: string | null | undefined;
  handle?: string | null | undefined;
}): Record<string, string> {
  const properties: Record<string, string> = { email: user.email, em: user.email };
  if (user.name) properties.name = user.name;
  if (user.handle) properties.handle = user.handle;
  return properties;
}
