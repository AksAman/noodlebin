export type YouTubeLink = { id: string; start: number | null; url: string }
export type TweetLink = { id: string; user: string; url: string }

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"])
const TWEET_HOSTS = new Set(["x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"])
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

export function youTubeEmbedSrc(link: YouTubeLink): string {
  return `https://www.youtube-nocookie.com/embed/${link.id}?rel=0${link.start ? `&start=${link.start}` : ""}`
}
