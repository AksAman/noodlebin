import { describe, expect, test } from "bun:test"
import { normalizeDatabaseUrl } from "@/lib/dbUrl"

describe("normalizeDatabaseUrl", () => {
  test("spells out verify-full for the modes pg aliases to it", () => {
    for (const mode of ["prefer", "require", "verify-ca"]) {
      const out = new URL(normalizeDatabaseUrl(`postgresql://u:p@host:5432/db?sslmode=${mode}`))
      expect(out.searchParams.get("sslmode")).toBe("verify-full")
    }
  })

  test("keeps other parameters and credentials", () => {
    const out = new URL(normalizeDatabaseUrl("postgresql://u:p%40ss@host/db?sslmode=require&connect_timeout=10"))
    expect(out.username).toBe("u")
    expect(out.password).toBe("p%40ss")
    expect(out.searchParams.get("connect_timeout")).toBe("10")
  })

  test("leaves other urls alone", () => {
    const local = "postgresql://postgres:postgres@localhost:5435/noodlebin"
    expect(normalizeDatabaseUrl(local)).toBe(local)
    const full = "postgresql://u:p@host/db?sslmode=verify-full"
    expect(normalizeDatabaseUrl(full)).toBe(full)
    const disable = "postgresql://u:p@host/db?sslmode=disable"
    expect(normalizeDatabaseUrl(disable)).toBe(disable)
    const compat = "postgresql://u:p@host/db?uselibpqcompat=true&sslmode=require"
    expect(normalizeDatabaseUrl(compat)).toBe(compat)
    expect(normalizeDatabaseUrl("not a url")).toBe("not a url")
  })
})
