import { describe, expect, test } from "bun:test"
import { siteOrigin } from "@/lib/site"

describe("site origin", () => {
  test("stays on localhost when no Vercel host is set", () => {
    const previousProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL
    const previousUrl = process.env.VERCEL_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    delete process.env.VERCEL_URL
    expect(siteOrigin()).toBe("http://localhost:5173")
    if (previousProduction === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProduction
    if (previousUrl === undefined) delete process.env.VERCEL_URL
    else process.env.VERCEL_URL = previousUrl
  })

  test("uses the production host ahead of the deployment host", () => {
    const previousProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL
    const previousUrl = process.env.VERCEL_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "nodevault-flame.vercel.app"
    process.env.VERCEL_URL = "nodevault-preview.vercel.app"
    expect(siteOrigin()).toBe("https://nodevault-flame.vercel.app")
    if (previousProduction === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProduction
    if (previousUrl === undefined) delete process.env.VERCEL_URL
    else process.env.VERCEL_URL = previousUrl
  })
})
