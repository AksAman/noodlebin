import { neon, Pool } from "@neondatabase/serverless"
import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { claimHandle } from "@/lib/handles"
import { siteOrigin } from "@/lib/site"
import { usesPostgres } from "@/lib/db"

let cached: any = null
let ready: Promise<void> | null = null

export function authConfigured(): boolean {
  return Boolean(process.env["DATABASE_URL"] && process.env["BETTER_AUTH_SECRET"])
}

function provider(idEnv: string, secretEnv: string) {
  const clientId = process.env[idEnv]
  const clientSecret = process.env[secretEnv]
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function getAuth() {
  if (!authConfigured()) throw new Error("Sign-in is not configured.")
  if (cached) return cached
  const google = provider("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")
  const twitter = provider("TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET")
  const discord = provider("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET")
  cached = betterAuth({
    secret: process.env["BETTER_AUTH_SECRET"],
    baseURL: process.env["BETTER_AUTH_URL"] || siteOrigin(),
    trustedOrigins: [siteOrigin(), "http://localhost:5173"],
    database: new Pool({ connectionString: process.env["DATABASE_URL"] }) as any,
    user: {
      additionalFields: {
        handle: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "discord", "twitter"],
      },
    },
    socialProviders: {
      ...(google
        ? {
            google: {
              ...google,
              mapProfileToUser: (profile) => ({ name: profile.name }),
            },
          }
        : {}),
      ...(twitter
        ? {
            twitter: {
              ...twitter,
              mapProfileToUser: (profile) => ({
                name: profile.data.name,
                handle: profile.data.username,
              }),
            },
          }
        : {}),
      ...(discord
        ? {
            discord: {
              ...discord,
              mapProfileToUser: (profile) => ({
                name: profile.global_name || profile.username,
                handle: profile.username,
              }),
            },
          }
        : {}),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const wanted = typeof user.handle === "string" && user.handle ? user.handle : user.name
            const handle = claimHandle(wanted, await takenHandles())
            return { data: { ...user, handle } }
          },
        },
      },
    },
    plugins: [nextCookies()],
  })
  return cached
}

async function takenHandles(): Promise<Set<string>> {
  const url = process.env["DATABASE_URL"]
  if (!url) return new Set()
  const sql = neon(url)
  const rows = (await sql`SELECT handle FROM "user" WHERE handle IS NOT NULL`) as { handle: string }[]
  return new Set(rows.map((row) => row.handle))
}

export async function ensureAuthReady(): Promise<void> {
  if (!authConfigured()) return
  if (!ready) ready = ensureAuthSchema()
  await ready
}

async function ensureAuthSchema(): Promise<void> {
  const url = process.env["DATABASE_URL"]
  if (!url) return
  const sql = neon(url)
  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL,
      image TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      handle TEXT UNIQUE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      scope TEXT,
      password TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS account_provider_unique ON account ("providerId", "accountId")`
  await sql`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS handle TEXT`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_handle_unique ON "user" (handle)`
  getAuth()
}

export type SessionAuthor = { id: string; name: string; handle: string }

/** The signed-in person, when Postgres auth is configured. Disk-mode tests stay anonymous. */
export async function sessionAuthor(): Promise<SessionAuthor | null> {
  if (!usesPostgres() || !authConfigured()) return null
  await ensureAuthReady()
  const { headers } = await import("next/headers")
  const session = await getAuth().api.getSession({ headers: await headers() })
  const user = session?.user as { id?: string; name?: string; handle?: string | null } | undefined
  if (!user?.id || !user.handle) return null
  return { id: user.id, name: user.name || user.handle, handle: user.handle }
}
