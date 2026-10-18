import { describe, expect, test } from "bun:test";
import { analyticsEnabled, personProperties, posthogApiHost } from "@/lib/analytics";

describe("analytics", () => {
  test("stays off without a project key", () => {
    const previous = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    expect(analyticsEnabled("/")).toBe(false);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = previous;
  });

  test("tracks site pages and skips embedded graphs", () => {
    const previous = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    expect(analyticsEnabled("/")).toBe(true);
    expect(analyticsEnabled("/p/a-graph")).toBe(true);
    expect(analyticsEnabled("/embed")).toBe(false);
    expect(analyticsEnabled("/embed/a-graph")).toBe(false);
    expect(analyticsEnabled("/embedded")).toBe(true);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = previous;
  });

  test("identifies a signed-in person by email, matching Mave", () => {
    expect(personProperties({ email: "a@b.co", name: "Aman", handle: "aman" })).toEqual({
      email: "a@b.co",
      em: "a@b.co",
      name: "Aman",
      handle: "aman",
    });
    expect(personProperties({ email: "a@b.co", name: "", handle: null })).toEqual({
      email: "a@b.co",
      em: "a@b.co",
    });
  });

  test("sends events through the first-party proxy unless a host is set", () => {
    const previous = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    expect(posthogApiHost()).toBe("/api/v1");
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
    expect(posthogApiHost()).toBe("https://eu.i.posthog.com");
    if (previous === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = previous;
  });
});
