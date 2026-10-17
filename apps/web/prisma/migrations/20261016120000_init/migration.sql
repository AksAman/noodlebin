-- Safe to run on a database that already has these tables.
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  handle TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS account_provider_unique ON account ("providerId", "accountId");

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS handle TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS user_handle_unique ON "user" (handle);

CREATE TABLE IF NOT EXISTS posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_slug TEXT,
  description TEXT,
  tree JSONB,
  tree_type TEXT NOT NULL CHECK (tree_type IN ('ShaderNodeTree', 'GeometryNodeTree', 'CompositorNodeTree')),
  blender_version_string TEXT NOT NULL,
  cover_url TEXT,
  video_url TEXT,
  blend_url TEXT,
  blend_filename TEXT,
  card_url TEXT,
  nodevember_day INTEGER CHECK (nodevember_day IS NULL OR (nodevember_day >= 1 AND nodevember_day <= 30)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seeded BOOLEAN NOT NULL DEFAULT false,
  edit_token_hash TEXT NOT NULL,
  cover_file TEXT,
  video_file TEXT,
  blend_file TEXT,
  youtube_url TEXT,
  tweet_url TEXT,
  cover_shader TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  tags TEXT[] NOT NULL DEFAULT '{}',
  search_text TEXT NOT NULL DEFAULT '',
  user_id TEXT
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tweet_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_shader TEXT;
ALTER TABLE posts ALTER COLUMN author_slug DROP NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS posts_author_slug_idx ON posts (author_slug);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);
