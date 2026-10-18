import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

function createAppEnv() {
  return createEnv({
    server: {
      NODE_ENV: z.enum(["development", "test", "production"]),
      DATABASE_URL: z.string().min(1).optional(),
      BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
      PUBLISH_SECRET: z.string().min(1).optional(),
      NODEVAULT_DATA_DIR: z.string().min(1).optional(),
      BETTER_AUTH_SECRET: z.string().min(1).optional(),
      BETTER_AUTH_URL: z.url().optional(),
      VERCEL: z.string().min(1).optional(),
      VERCEL_URL: z.string().min(1).optional(),
      VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
      DISCORD_CLIENT_ID: z.string().min(1).optional(),
      DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
      GOOGLE_CLIENT_ID: z.string().min(1).optional(),
      GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
      TWITTER_CLIENT_ID: z.string().min(1).optional(),
      TWITTER_CLIENT_SECRET: z.string().min(1).optional(),
      AZURE_STORAGE_ACCOUNT: z.string().min(1).optional(),
      AZURE_STORAGE_KEY: z.string().min(1).optional(),
      AZURE_STORAGE_CONTAINER: z.string().min(1).optional(),
      AZURE_CDN_BASE_URL: z.url().optional(),
    },
    client: {
      NEXT_PUBLIC_BASE_URL: z.url().default("http://localhost:5173"),
      NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
      NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
    },
    runtimeEnv: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
      PUBLISH_SECRET: process.env.PUBLISH_SECRET,
      NODEVAULT_DATA_DIR: process.env.NODEVAULT_DATA_DIR,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      VERCEL: process.env.VERCEL,
      VERCEL_URL: process.env.VERCEL_URL,
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
      DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
      TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
      AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT,
      AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY,
      AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER,
      AZURE_CDN_BASE_URL: process.env.AZURE_CDN_BASE_URL,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    },
    emptyStringAsUndefined: true,
  });
}

type AppEnv = ReturnType<typeof createAppEnv>;

/** Reads the current process env on each access, so tests can change a variable between cases. */
export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined;
    return createAppEnv()[prop as keyof AppEnv];
  },
});
