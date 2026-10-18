import { env } from "@/env";
import { analyticsEnabled, POSTHOG_UI_HOST, posthogApiHost } from "@/lib/analytics";
import posthog from "posthog-js";

const key = env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && typeof window !== "undefined" && analyticsEnabled(window.location.pathname)) {
  posthog.init(key, {
    api_host: posthogApiHost(),
    ui_host: POSTHOG_UI_HOST,
    defaults: "2026-05-30",
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
  });
}
