import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import { claimHandle } from "@/lib/handles";
import { ensureSchema, getPrisma } from "@/lib/prisma";
import { siteOrigin } from "@/lib/site";
import { usesPostgres } from "@/lib/db";

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
        trustedProviders: ["google", "discord", "twitter", "email-password"],
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
    plugins: [nextCookies()],
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

/** The signed-in person, when Postgres auth is configured. Disk-mode tests stay anonymous. */
export async function sessionAuthor(): Promise<SessionAuthor | null> {
  if (!usesPostgres() || !authConfigured()) return null;
  await ensureAuthReady();
  const { headers } = await import("next/headers");
  const session = await getAuth().api.getSession({ headers: await headers() });
  const user = session?.user as
    | { id?: string; name?: string; handle?: string | null }
    | undefined;
  if (!user?.id || !user.handle) return null;
  return { id: user.id, name: user.name || user.handle, handle: user.handle };
}
