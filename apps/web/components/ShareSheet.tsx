"use client"

import { publishPost } from "@/lib/publishPost"
import { serializeCopy, treeTypeLabel } from "@/lib/ingest"
import type { NodeVaultPayload } from "@/interchange"
import { Kbd, useModKey } from "@/components/Keys"
import { ShaderCover } from "@/components/ShaderCover"
import { parseTweet, parseYouTube } from "@/lib/embeds"
import { coverByteBudget, publishFailureMessage } from "@/lib/publishBody"
import { checkShaderSource } from "@/lib/shaderCover"
import { fitCoverFile } from "@/lib/shrinkCover"
import { btnAccent, btnGhost, cn, errorBox, field, treeDotClass } from "@/lib/ui"
import { useCallback, useEffect, useRef, useState } from "react"

const AUTHOR_KEY = "nodevault.author_name"

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

function pastedName(type: string): string {
  const ext = type === "image/jpeg" ? "jpg" : type.slice("image/".length)
  return `pasted-image.${ext}`
}

type LinkSpec = {
  name: "youtube_url" | "tweet_url"
  label: string
  placeholder: string
  invalid: string
  parse: (raw: string) => unknown
}

const LINKS: LinkSpec[] = [
  {
    name: "youtube_url",
    label: "YouTube video",
    placeholder: "youtube.com/watch?v=…",
    invalid: "That isn’t a link to a single YouTube video.",
    parse: parseYouTube,
  },
  {
    name: "tweet_url",
    label: "X post",
    placeholder: "x.com/you/status/…",
    invalid: "That isn’t a link to a single post on x.com or twitter.com.",
    parse: parseTweet,
  },
]

function linkIsValid(spec: LinkSpec, raw: string): boolean {
  return !raw.trim() || spec.parse(raw) !== null
}

function LinkField({ spec }: { spec: LinkSpec }) {
  const [invalid, setInvalid] = useState(false)
  const hintId = `${spec.name}-hint`
  return (
    <label className={label}>
      {spec.label}
      <input
        className={cn(field, invalid && "!border-danger-fg")}
        name={spec.name}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        maxLength={500}
        placeholder={spec.placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? hintId : undefined}
        onBlur={(e) => setInvalid(!linkIsValid(spec, e.target.value))}
        onChange={(e) => {
          if (invalid && linkIsValid(spec, e.target.value)) setInvalid(false)
        }}
      />
      {invalid ? (
        <span id={hintId} className="text-[12px] font-normal text-danger-fg">
          {spec.invalid}
        </span>
      ) : null}
    </label>
  )
}

const SHADER_STARTER = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4)), 1.0);
}`

/** Shadertoy-style GLSL that plays over the cover image. Reports its problem up so publishing can stop on it. */
function ShaderField({ poster, onProblem }: { poster: string | null; onProblem: (problem: string | null) => void }) {
  const [text, setText] = useState("")
  const [live, setLive] = useState("")
  const [compileError, setCompileError] = useState<string | null>(null)
  useEffect(() => {
    const id = setTimeout(() => setLive(text), 400)
    return () => clearTimeout(id)
  }, [text])
  const checked = live.trim() ? checkShaderSource(live) : null
  const problem = checked && !checked.ok ? checked.error : compileError
  useEffect(() => onProblem(text.trim() ? problem : null), [problem, text, onProblem])
  return (
    <details className="group -mt-2 text-[13px]" open={text.length > 0 || undefined}>
      <summary className="cursor-pointer list-none text-muted marker:hidden hover:text-fg">
        <span className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        Animate the cover with a GLSL shader <span className="text-subtle">(optional)</span>
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {checked?.ok ? (
          <ShaderCover
            source={checked.source}
            poster={poster}
            className="aspect-video rounded-lg ring-1 ring-line"
            onError={setCompileError}
          />
        ) : null}
        <textarea
          className={cn(field, "min-h-40 resize-y font-mono text-[12px] leading-relaxed")}
          name="cover_shader"
          spellCheck={false}
          autoComplete="off"
          wrap="off"
          placeholder={SHADER_STARTER}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby="shader-hint"
        />
        <span
          id="shader-hint"
          role={problem ? "alert" : undefined}
          className={cn("whitespace-pre-wrap text-[12px]", problem ? "font-mono text-danger-fg" : "text-subtle")}
        >
          {problem ??
            "Paste a Shadertoy-style mainImage function. iResolution, iTime, and iFrame are available. The image above stays as the fallback and the link preview."}
        </span>
        {!text ? (
          <button type="button" className={cn(btnGhost, "self-start")} onClick={() => setText(SHADER_STARTER)}>
            Start from an example
          </button>
        ) : null}
      </div>
    </details>
  )
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
}

type Created = { url: string }

const sheet =
  "relative z-[1] flex h-full w-full max-w-[420px] animate-[sheet-in_380ms_var(--ease-out-expo)_both] flex-col gap-6 overflow-auto border-l border-line bg-bg px-6 pb-7 pt-6 text-fg shadow-[-24px_0_60px_-20px_rgb(0_0_0/45%)]"

const label = "flex flex-col gap-2 text-[13px] font-medium text-fg"

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="-mr-2 -mt-1 grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-sunken hover:text-fg"
      onClick={onClick}
      aria-label="Close"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}

export function ShareSheet({
  payload,
  onClose,
}: {
  payload: NodeVaultPayload
  onClose: (publishedUrl?: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const [author, setAuthor] = useState("")
  const [coverName, setCoverName] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [shaderProblem, setShaderProblem] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const mod = useModKey()

  const showCover = useCallback((file: File | null) => {
    setCoverError(null)
    setCoverName(file?.name ?? null)
    setCoverPreview(file ? URL.createObjectURL(file) : null)
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData
      if (!data || created) return
      const image = [...data.files].find((f) => f.type.startsWith("image/"))
      if (!image) return
      if (isTextField(event.target) && data.getData("text/plain").trim()) return
      event.preventDefault()
      event.stopPropagation()
      const input = coverRef.current
      if (!COVER_TYPES.includes(image.type) || !input) {
        setCoverError("That image type can’t be used. Paste a JPEG, PNG, WebP, or GIF.")
        return
      }
      const named = new File([image], image.name && image.name !== "image.png" ? image.name : pastedName(image.type), {
        type: image.type,
      })
      const transfer = new DataTransfer()
      transfer.items.add(named)
      input.files = transfer.files
      showCover(named)
    }
    window.addEventListener("paste", onPaste, { capture: true })
    return () => window.removeEventListener("paste", onPaste, { capture: true })
  }, [created, showCover])

  const count = payload.origin.node_count
  const typeLabel = treeTypeLabel(payload.tree_type)
  const defaultTitle = `${count} ${typeLabel.toLowerCase()} node${count === 1 ? "" : "s"}`

  useEffect(() => {
    try {
      setAuthor(localStorage.getItem(AUTHOR_KEY) ?? "")
    } catch {
      setAuthor("")
    }
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(created?.url)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, created])

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  if (created) {
    return (
      <div className={sheet} role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-title" className="m-0 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            It’s live.
          </h2>
          <CloseButton onClick={() => onClose(created.url)} />
        </div>
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Anyone with the link can open the graph and copy it into Blender.
        </p>
        <a className="break-all rounded-md bg-sunken px-3 py-2.5 font-mono text-[12px] text-fg no-underline" href={created.url}>
          {created.url}
        </a>
        <a className={cn(btnAccent, "py-2.5")} href={created.url}>
          Open post
        </a>
      </div>
    )
  }

  return (
    <form
      className={sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const submitted = new FormData(form)
        const name = String(submitted.get("author_name") ?? "").trim()
        try {
          if (name) localStorage.setItem(AUTHOR_KEY, name)
        } catch {
          /* ignore */
        }
        const badLink = LINKS.find((l) => !linkIsValid(l, String(submitted.get(l.name) ?? "")))
        if (badLink) {
          setError(badLink.invalid)
          form.querySelector<HTMLInputElement>(`[name="${badLink.name}"]`)?.focus()
          return
        }
        if (shaderProblem) {
          setError(`The cover shader has a problem: ${shaderProblem}`)
          form.querySelector<HTMLTextAreaElement>('[name="cover_shader"]')?.focus()
          return
        }
        const treeText = serializeCopy(payload)
        const cover = submitted.get("cover")
        setBusy(true)
        setError(null)
        void (async () => {
          const body = submitted
          body.set("tree_text", treeText)
          if (cover instanceof File && cover.size > 0) {
            const fitted = await fitCoverFile(cover, coverByteBudget(new Blob([treeText]).size))
            body.set("cover", fitted)
          }
          const createdPost = await publishPost(body)
          if ("error" in createdPost) {
            setError(createdPost.error)
            return
          }
          setCreated({ url: createdPost.url })
        })()
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : ""
            setError(publishFailureMessage(0, message) ?? (message || "Could not reach the server. Check your connection and try again."))
          })
          .finally(() => setBusy(false))
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="share-title" className="m-0 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em]">
            Share this graph
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted tabular-nums">
            <span className={treeDotClass(payload.tree_type)} aria-hidden="true" />
            {typeLabel} · Blender {payload.blender_version_string} · {count} node{count === 1 ? "" : "s"}
          </p>
        </div>
        <CloseButton onClick={() => onClose()} />
      </div>

      <label className={label}>
        Cover image
        <span
          className={cn(
            "relative block overflow-hidden rounded-lg border border-dashed border-line-strong bg-sunken text-center text-[13px] font-normal text-muted transition-colors duration-150 has-[:focus-visible]:border-accent hover:border-subtle",
            coverPreview ? "aspect-video" : "px-4 py-8",
          )}
        >
          {coverPreview ? (
            <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <>
              <span className="block text-fg">Choose a render or screenshot</span>
              <span className="mt-1 block text-subtle">
                or paste one with <Kbd>{`${mod} V`}</Kbd>
              </span>
            </>
          )}
          <input
            ref={coverRef}
            className="absolute inset-0 cursor-pointer opacity-0"
            name="cover"
            type="file"
            accept={COVER_TYPES.join(",")}
            required
            aria-describedby="cover-name"
            onChange={(event) => showCover(event.target.files?.[0] ?? null)}
          />
        </span>
        <span
          id="cover-name"
          role={coverError ? "alert" : undefined}
          className={cn("text-[12px] font-normal", coverError ? "text-danger-fg" : "text-subtle")}
        >
          {coverError ??
            (coverName ? `${coverName} · paste another image to replace it` : "JPEG, PNG, WebP, or GIF. This is what people see in the gallery.")}
        </span>
      </label>

      <ShaderField poster={coverPreview} onProblem={setShaderProblem} />

      <label className={label}>
        Title
        <input ref={titleRef} className={field} name="title" required maxLength={120} defaultValue={defaultTitle} />
      </label>
      <label className={label}>
        Your name
        <input
          className={field}
          name="author_name"
          required
          maxLength={80}
          autoComplete="name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
      </label>
      <label className={label}>
        <span>
          Note <span className="font-normal text-subtle">(optional)</span>
        </span>
        <textarea
          className={cn(field, "resize-y")}
          name="description"
          rows={3}
          placeholder="What should someone know before they paste this?"
        />
      </label>

      <fieldset className="m-0 flex flex-col gap-4 border-0 border-t border-line p-0 pt-5">
        <legend className="float-left mb-1 w-full p-0 text-[13px] font-medium text-fg">
          Links <span className="font-normal text-subtle">(optional)</span>
          <span className="mt-1 block text-[12px] font-normal text-subtle">A breakdown video or the post where you showed it off. Either, both, or neither.</span>
        </legend>
        {LINKS.map((spec) => (
          <LinkField key={spec.name} spec={spec} />
        ))}
      </fieldset>

      {error ? (
        <p role="alert" className={cn(errorBox, "m-0")}>
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex justify-end gap-2 border-t border-line pt-5">
        <button type="button" className={btnGhost} onClick={() => onClose()}>
          Not now
        </button>
        <button type="submit" className={cn(btnAccent, "px-5")} disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      </div>
    </form>
  )
}
