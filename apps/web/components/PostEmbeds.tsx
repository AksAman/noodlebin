"use client"

import { InlineLoader } from "@/components/Loader"
import { parseInstagram, parseTweet, parseYouTube, youTubeEmbedSrc, type InstagramLink, type TweetLink } from "@/lib/embeds"
import { cn } from "@/lib/ui"
import { useEffect, useRef, useState } from "react"

type Twttr = {
  ready: (cb: (t: Twttr) => void) => void
  widgets: {
    createTweet: (id: string, el: HTMLElement, options: Record<string, unknown>) => Promise<HTMLElement | undefined>
  }
}

declare global {
  interface Window {
    twttr?: Twttr
  }
}

let widgetsLoader: Promise<Twttr> | null = null

function loadWidgets(): Promise<Twttr> {
  if (window.twttr?.widgets) return Promise.resolve(window.twttr)
  widgetsLoader ??= new Promise<Twttr>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://platform.twitter.com/widgets.js"
    script.async = true
    script.onload = () => (window.twttr ? window.twttr.ready(resolve) : reject(new Error("widgets.js missing")))
    script.onerror = () => {
      widgetsLoader = null
      script.remove()
      reject(new Error("widgets.js blocked"))
    }
    document.head.appendChild(script)
  })
  return widgetsLoader
}

function resolvedTheme(): "light" | "dark" {
  const explicit = document.documentElement.getAttribute("data-theme")
  if (explicit === "light" || explicit === "dark") return explicit
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function useResolvedTheme(): "light" | "dark" | null {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null)
  useEffect(() => {
    const update = () => setTheme(resolvedTheme())
    update()
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", update)
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => {
      media.removeEventListener("change", update)
      observer.disconnect()
    }
  }, [])
  return theme
}

export function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z"
      />
    </svg>
  )
}

function TweetEmbed({ tweet }: { tweet: TweetLink }) {
  const host = useRef<HTMLDivElement>(null)
  const theme = useResolvedTheme()
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const el = host.current
    if (!el || !theme) return
    let cancelled = false
    setState("loading")
    el.replaceChildren()
    loadWidgets()
      .then((twttr) => twttr.widgets.createTweet(tweet.id, el, { theme, dnt: true, conversation: "none", align: "center" }))
      .then((created) => {
        if (!cancelled) setState(created ? "ready" : "failed")
      })
      .catch(() => {
        if (!cancelled) setState("failed")
      })
    return () => {
      cancelled = true
    }
  }, [tweet.id, theme])

  return (
    <div>
      <div ref={host} className={cn("[&_.twitter-tweet]:!my-0", state === "failed" && "hidden")} />
      {state !== "ready" ? (
        <a
          href={tweet.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 text-fg no-underline transition-colors duration-150 hover:border-line-strong"
        >
          <XGlyph className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">{tweet.user === "i" ? "Post on X" : `Post by @${tweet.user}`}</span>
            <span className="block text-[12px] text-muted">
              {state === "loading" ? <InlineLoader label="Loading post" /> : "Open on x.com"}
            </span>
          </span>
          <span aria-hidden="true" className="text-subtle">
            ↗
          </span>
        </a>
      ) : null}
    </div>
  )
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm8 1.8H8A3.2 3.2 0 0 0 4.8 8v8A3.2 3.2 0 0 0 8 19.2h8a3.2 3.2 0 0 0 3.2-3.2V8A3.2 3.2 0 0 0 16 4.8ZM12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2Zm0 1.6A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8ZM17.15 6.7a1.05 1.05 0 1 1-1.05 1.05 1.05 1.05 0 0 1 1.05-1.05Z"
      />
    </svg>
  )
}

function InstagramEmbed({ link }: { link: InstagramLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 text-fg no-underline transition-colors duration-150 hover:border-line-strong"
    >
      <InstagramGlyph className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{link.kind === "reel" ? "Reel on Instagram" : "Post on Instagram"}</span>
        <span className="block text-[12px] text-muted">Open on instagram.com</span>
      </span>
      <span aria-hidden="true" className="text-subtle">
        ↗
      </span>
    </a>
  )
}

export function PostEmbeds({ youtubeUrl, tweetUrl, title }: { youtubeUrl: string | null; tweetUrl: string | null; title: string }) {
  const video = youtubeUrl ? parseYouTube(youtubeUrl) : null
  const tweet = tweetUrl ? parseTweet(tweetUrl) : null
  const instagram = !tweet && tweetUrl ? parseInstagram(tweetUrl) : null
  if (!video && !tweet && !instagram) return null
  return (
    <div className="flex flex-col gap-4">
      {video ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-sunken ring-1 ring-line">
          <iframe
            className="block size-full border-0"
            src={youTubeEmbedSrc(video)}
            title={`YouTube video for ${title}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : null}
      {tweet ? <TweetEmbed tweet={tweet} /> : null}
      {instagram ? <InstagramEmbed link={instagram} /> : null}
    </div>
  )
}
