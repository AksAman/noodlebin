import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import { claimHandle, providerUsername } from "@/lib/handles";
import { ensureSchema, getPrisma } from "@/lib/prisma";
import { siteOrigin } from "@/lib/site";
import { usesPostgres } from "@/lib/db";
import { dash } from "@better-auth/infra";
import { headers } from "next/headers";
import { cache } from "react";

let cached: any = null;
let ready: Promise<void> | null = null;

export function authConfigured(): boolean {
  return Boolean(env.DATABASE_URL && env.BETTER_AUTH_SECRET);
}

function provider(
  clientId: string | undefined,
  clientSecret: string | undefined,
) {
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getAuth() {
  if (!authConfigured()) throw new Error("Sign-in is not configured.");
  if (cached) return cached;
  const google = provider(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const twitter = provider(env.TWITTER_CLIENT_ID, env.TWITTER_CLIENT_SECRET);
  const discord = provider(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET);
  cached = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || siteOrigin(),
    trustedOrigins: [siteOrigin(), env.NEXT_PUBLIC_BASE_URL],
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    session: {
      // Signed cookie so the layout can read the session without a database round trip.
      // A revoked session can linger until maxAge; publish bypasses this cache.
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
      deferSessionRefresh: true,
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        handle: {
          type: "string",
          required: false,
          input: false,
        },
      },
      // input: false strips handle out of mapProfileToUser. This runs on the
      // same user object the create hook then claims, so the provider username
      // still wins over the display name.
      validateUserInfo({ user, source }) {
        const username = providerUsername(source.oauth);
        if (username) user.handle = username;
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "discord", "twitter", "credential"],
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
              mapProfileToUser: (profile) => ({ name: profile.data.name }),
            },
          }
        : {}),
      ...(discord
        ? {
            discord: {
              ...discord,
              mapProfileToUser: (profile) => ({
                name: profile.global_name || profile.username,
              }),
            },
          }
        : {}),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const wanted =
              typeof user.handle === "string" && user.handle
                ? user.handle
                : user.name;
            const handle = claimHandle(wanted, await takenHandles());
            return { data: { ...user, handle } };
          },
        },
      },
    },
    // nextCookies has to be last so it can see every Set-Cookie header.
    plugins: [dash(), nextCookies()],
  });
  return cached;
}

async function takenHandles(): Promise<Set<string>> {
  if (!env.DATABASE_URL) return new Set();
  const prisma = await ensureSchema();
  const rows = await prisma.user.findMany({
    where: { handle: { not: null } },
    select: { handle: true },
  });
  return new Set(rows.flatMap((row) => (row.handle ? [row.handle] : [])));
}

export async function ensureAuthReady(): Promise<void> {
  if (!authConfigured()) return;
  if (!ready) ready = ensureSchema().then(() => undefined);
  await ready;
}

export type SessionAuthor = { id: string; name: string; handle: string };

/**
 * The request session, read on the server from the auth cookie.
 * Null when auth is off (disk-mode tests) or nobody is signed in.
 * Cached for the request so the layout and pages share one lookup.
 */
export const getRequestSession = cache(async () => {
  if (!usesPostgres() || !authConfigured()) return null;
  await ensureAuthReady();
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  // Dates and undefined fields cannot cross into a client component as-is.
  return JSON.parse(JSON.stringify(session));
});

/** The signed-in person, when Postgres auth is configured. Disk-mode tests stay anonymous. */
export async function sessionAuthor(): Promise<SessionAuthor | null> {
  if (!usesPostgres() || !authConfigured()) return null;
  await ensureAuthReady();
  const session = await getAuth().api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  const user = session?.user as
    | { id?: string; name?: string; handle?: string | null }
    | undefined;
  if (!user?.id || !user.handle) return null;
  return { id: user.id, name: user.name || user.handle, handle: user.handle };
}
