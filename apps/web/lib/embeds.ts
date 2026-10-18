export type YouTubeLink = { id: string; start: number | null; url: string }
export type TweetLink = { id: string; user: string; url: string }
export type InstagramLink = { kind: "post" | "reel"; code: string; url: string }

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"])
const TWEET_HOSTS = new Set(["x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"])
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"])
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{5,30}$/
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

function toUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

function parseStart(value: string | null): number | null {
  if (!value) return null
  const plain = /^(\d+)s?$/.exec(value)
  if (plain) return Number(plain[1])
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!parts) return null
  const seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
  return seconds > 0 ? seconds : null
}

/** Accepts watch, youtu.be, shorts, live, and embed links. */
export function parseYouTube(raw: string): YouTubeLink | null {
  const url = toUrl(raw)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  let id: string | null = null
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/")
    if (first === "watch") id = url.searchParams.get("v")
    else if (first === "shorts" || first === "live" || first === "embed" || first === "v") id = second ?? null
  }
  if (!id || !VIDEO_ID.test(id)) return null
  const start = parseStart(url.searchParams.get("t") ?? url.searchParams.get("start"))
  return { id, start, url: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}` }
}

/** Accepts x.com and twitter.com status links, with or without a handle. */
export function parseTweet(raw: string): TweetLink | null {
  const url = toUrl(raw)
  if (!url || !TWEET_HOSTS.has(url.hostname.toLowerCase())) return null
  const match = /^\/(?:([A-Za-z0-9_]{1,15})|i(?:\/web)?)\/status(?:es)?\/(\d{1,25})/.exec(url.pathname)
  if (!match) return null
  const user = match[1] ?? "i"
  const id = match[2]!
  return { id, user, url: `https://x.com/${user}/status/${id}` }
}

/** Accepts an Instagram post or reel. Profile, story, and explore links are not posts. */
export function parseInstagram(raw: string): InstagramLink | null {
  const url = toUrl(raw)
  if (!url || !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null
  const parts = url.pathname.split("/").filter(Boolean)
  let kind: InstagramLink["kind"] | null = null
  let code: string | null = null
  if (parts[0] === "p" || parts[0] === "tv") {
    kind = "post"
    code = parts[1] ?? null
  } else if (parts[0] === "reel" || parts[0] === "reels") {
    kind = "reel"
    code = parts[1] ?? null
  } else if (parts[0] === "share" && (parts[1] === "p" || parts[1] === "reel" || parts[1] === "reels")) {
    kind = parts[1] === "p" ? "post" : "reel"
    code = parts[2] ?? null
  }
  if (!kind || !code || !INSTAGRAM_CODE.test(code)) return null
  const path = kind === "reel" ? "reel" : "p"
  return { kind, code, url: `https://www.instagram.com/${path}/${code}/` }
}

/** One field accepts either an X post or an Instagram post or reel. */
export function parseSocialPost(raw: string): TweetLink | InstagramLink | null {
  return parseTweet(raw) ?? parseInstagram(raw)
}

export function youTubeEmbedSrc(link: YouTubeLink): string {
  return `https://www.youtube-nocookie.com/embed/${link.id}?rel=0${link.start ? `&start=${link.start}` : ""}`
}
