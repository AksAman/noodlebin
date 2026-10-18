"use client"

import { AuthorCredit } from "@/components/AuthorCredit"
import { MarkdownNote } from "@/components/MarkdownNote"
import { NodeView } from "@/node-view"
import { capture } from "@/lib/analytics"
import { serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { Catalog } from "@/catalog"
import type { VaultPost } from "@/lib/posts"
import type { NodeVaultPayload } from "@/interchange"
import { Kbd, useModKey } from "@/components/Keys"
import { PayloadFallback } from "@/components/PayloadFallback"
import { SharePost } from "@/components/SharePost"
import { PostEmbeds, XGlyph } from "@/components/PostEmbeds"
import { ShaderCover } from "@/components/ShaderCover"
import { creator } from "@/lib/creator"
import { btnAccent, btnGhost, canvas, cn, notice as noticeClass, treeDotClass, treeEditorName } from "@/lib/ui"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"

export function PostGraph({
  post,
  payload,
  catalog,
  notice,
}: {
  post: VaultPost
  payload: NodeVaultPayload
  catalog: Catalog | null
  notice: string | null
}) {
  const [copied, setCopied] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = payload.trees.find((t) => t.is_root) ?? payload.trees[0]
  const groups = payload.trees.length - 1
  const nodes = payload.origin.node_count
  const mod = useModKey()

  const onCopy = useCallback(async () => {
    const text = serializeCopy(payload)
    try {
      await navigator.clipboard.writeText(text)
      capture("graph_copied", { surface: "post", tree_type: payload.tree_type, slug: post.slug })
      setCopied(true)
      setFallbackText(null)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2400)
    } catch {
      setFallbackText(text)
    }
  }, [payload, post.slug])

  if (!root) return null

  return (
    <div data-fullbleed className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-6 border-line px-5 py-7 sm:px-8 md:w-[340px] md:overflow-y-auto md:border-r md:px-6 lg:w-[380px] lg:px-7">
        {post.video_url ? (
          <video
            className="block w-full rounded-lg bg-sunken ring-1 ring-line"
            controls
            poster={post.cover_url ?? undefined}
            src={post.video_url}
          />
        ) : post.cover_shader ? (
          <ShaderCover
            source={post.cover_shader}
            poster={post.cover_url}
            className={cn("rounded-lg ring-1 ring-line", post.cover_url ? "max-h-56 md:max-h-72" : "aspect-[4/3]")}
          />
        ) : post.cover_url ? (
          <img className="block max-h-56 w-full rounded-lg object-cover ring-1 ring-line md:max-h-72" src={post.cover_url} alt="" />
        ) : null}

        <div>
          <h1 className="m-0 font-display text-[clamp(1.75rem,1.4rem+1.2vw,2.35rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-fg">
            {post.title}
          </h1>
          <p className="mt-3 text-[14px] text-muted">
            by <AuthorCredit name={post.author_name} slug={post.author_slug} />
          </p>
        </div>

        {post.description ? <MarkdownNote className="note-markdown max-w-[60ch]" source={post.description} /> : null}

        <PostEmbeds youtubeUrl={post.youtube_url} tweetUrl={post.tweet_url} title={post.title} />

        {post.cover_shader ? (
          <details className="group text-[13px]">
            <summary className="cursor-pointer list-none text-muted marker:hidden hover:text-fg">
              <span className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90" aria-hidden="true">
                ›
              </span>
              Cover shader (GLSL)
            </summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-sunken p-3 font-mono text-[11px] leading-relaxed text-fg">
              {post.cover_shader}
            </pre>
          </details>
        ) : null}

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-line py-4 text-[13px] tabular-nums">
          <dt className="text-subtle">Tree</dt>
          <dd className="m-0 flex items-center gap-2 text-fg">
            <span className={treeDotClass(post.tree_type)} aria-hidden="true" />
            {treeTypeLabel(post.tree_type)}
          </dd>
          <dt className="text-subtle">Blender</dt>
          <dd className="m-0 text-fg">{post.blender_version_string}</dd>
          <dt className="text-subtle">Contents</dt>
          <dd className="m-0 text-fg">
            {nodes} node{nodes === 1 ? "" : "s"}
            {groups > 0 ? `, ${groups} group${groups === 1 ? "" : "s"}` : ""}
          </dd>
          {post.nodevember_day ? (
            <>
              <dt className="text-subtle">Nodevember</dt>
              <dd className="m-0 text-fg">Day {post.nodevember_day}</dd>
            </>
          ) : null}
        </dl>

        {notice ? <p className={cn(noticeClass, "m-0")}>{notice}</p> : null}

        <div className="flex flex-col gap-3">
          <button type="button" className={cn(btnAccent, "w-full py-3 text-[15px]")} onClick={() => void onCopy()}>
            {copied ? "Copied. Now paste in Blender" : "Copy for Blender"}
          </button>
          <p className="m-0 text-[13px] leading-relaxed text-muted" aria-live="polite">
            In the {treeEditorName(post.tree_type)}, press <Kbd>{`${mod} ⇧ V`}</Kbd> to drop the nodes at your cursor.
          </p>
          <p className="m-0 text-[13px] leading-relaxed text-subtle">
            Pasting needs the NodeVault add-on.{" "}
            <Link className="text-accent-fg underline-offset-4 hover:underline" href="/addon">
              Get it here
            </Link>
            .
          </p>
          {post.blend_url ? (
            <a className="text-[13px] text-accent-fg underline-offset-4 hover:underline" href={post.blend_url}>
              Download {post.blend_filename ?? "graph.blend"}
            </a>
          ) : null}
          <SharePost slug={post.slug} />
        </div>

        <a
          href={creator.xUrl}
          target="_blank"
          rel="noopener noreferrer me"
          className="group mt-auto flex items-center gap-2 border-t border-line pt-5 text-[12px] text-subtle no-underline transition-colors duration-150 hover:text-fg"
        >
          <XGlyph className="size-3.5" />
          NodeVault is made by <span className="font-medium text-muted group-hover:text-fg">@{creator.handle}</span>
        </a>
      </aside>

      <div className={cn(canvas, "min-h-[70vh] md:min-h-0")} data-theme="dark">
        <NodeView
          tree={root}
          trees={payload.trees}
          catalog={catalog}
          readOnly
          onCopy={() => void onCopy()}
          blenderVersion={payload.blender_version_string}
          showMinimap={showMinimap}
        />
        <button
          type="button"
          className={cn(btnGhost, "absolute right-3 top-3 z-[5] bg-[rgb(23_23_23/80%)] backdrop-blur-sm")}
          onClick={() => setShowMinimap((v) => !v)}
          aria-pressed={showMinimap}
        >
          {showMinimap ? "Hide map" : "Show map"}
        </button>
        {fallbackText ? <PayloadFallback text={fallbackText} /> : null}
      </div>
    </div>
  )
}
