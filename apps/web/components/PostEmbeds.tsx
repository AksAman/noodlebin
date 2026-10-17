"use client"

import { InlineLoader } from "@/components/Loader"
import { parseTweet, parseYouTube, youTubeEmbedSrc, type TweetLink } from "@/lib/embeds"
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

export function PostEmbeds({ youtubeUrl, tweetUrl, title }: { youtubeUrl: string | null; tweetUrl: string | null; title: string }) {
  const video = youtubeUrl ? parseYouTube(youtubeUrl) : null
  const tweet = tweetUrl ? parseTweet(tweetUrl) : null
  if (!video && !tweet) return null
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
    </div>
  )
}
