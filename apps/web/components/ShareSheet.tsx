"use client";

import { InlineLoader } from "@/components/Loader";
import { publishPost } from "@/lib/publishPost";
import { serializeCopy, treeTypeLabel } from "@/lib/ingest";
import type { NodeVaultPayload } from "@/interchange";
import { Dialog } from "@/components/Dialog";
import { MarkdownField } from "@/components/MarkdownField";
import { SignInButtons } from "@/components/SignInButtons";
import { TagPills } from "@/components/TagPills";
import { Kbd, useModKey } from "@/components/Keys";
import { ShaderCover } from "@/components/ShaderCover";
import { useServerSession } from "@/components/SessionProvider";
import { captureNodeCanvas } from "@/lib/captureCanvas";
import { parseTweet, parseYouTube } from "@/lib/embeds";
import { coverByteBudget, publishFailureMessage } from "@/lib/publishBody";
import { checkShaderSource } from "@/lib/shaderCover";
import { SHARE_DRAFT_KEY, type ShareDraft } from "@/lib/shareDraft";
import { addTag, tagToken } from "@/lib/tags";
import { fitCoverFile } from "@/lib/shrinkCover";
import {
  btnAccent,
  btn,
  btnGhost,
  cn,
  errorBox,
  field,
  treeDotClass,
} from "@/lib/ui";
import { useCallback, useEffect, useRef, useState } from "react";

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function pastedName(type: string): string {
  const ext = type === "image/jpeg" ? "jpg" : type.slice("image/".length);
  return `pasted-image.${ext}`;
}

type LinkSpec = {
  name: "youtube_url" | "tweet_url";
  label: string;
  placeholder: string;
  invalid: string;
  parse: (raw: string) => unknown;
};

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
];

function linkIsValid(spec: LinkSpec, raw: string): boolean {
  return !raw.trim() || spec.parse(raw) !== null;
}

function LinkField({
  spec,
  defaultValue = "",
}: {
  spec: LinkSpec;
  defaultValue?: string;
}) {
  const [invalid, setInvalid] = useState(false);
  const hintId = `${spec.name}-hint`;
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
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? hintId : undefined}
        onBlur={(e) => setInvalid(!linkIsValid(spec, e.target.value))}
        onChange={(e) => {
          if (invalid && linkIsValid(spec, e.target.value)) setInvalid(false);
        }}
      />
      {invalid ? (
        <span id={hintId} className="text-[12px] font-normal text-danger-fg">
          {spec.invalid}
        </span>
      ) : null}
    </label>
  );
}

const SHADER_STARTER = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4)), 1.0);
}`;

/** Shadertoy-style GLSL that plays over the cover image. Reports its problem up so publishing can stop on it. */
function ShaderField({
  poster,
  onProblem,
  initial = "",
}: {
  poster: string | null;
  onProblem: (problem: string | null) => void;
  initial?: string;
}) {
  const [text, setText] = useState(initial);
  const [live, setLive] = useState("");
  const [compileError, setCompileError] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setLive(text), 400);
    return () => clearTimeout(id);
  }, [text]);
  const checked = live.trim() ? checkShaderSource(live) : null;
  const problem = checked && !checked.ok ? checked.error : compileError;
  useEffect(
    () => onProblem(text.trim() ? problem : null),
    [problem, text, onProblem],
  );
  return (
    <details
      className="group -mt-2 text-[13px]"
      open={text.length > 0 || undefined}
    >
      <summary className="cursor-pointer list-none text-muted marker:hidden hover:text-fg">
        <span
          className="mr-1.5 inline-block transition-transform duration-150 group-open:rotate-90"
          aria-hidden="true"
        >
          ›
        </span>
        Animate the cover with a GLSL shader{" "}
        <span className="text-subtle">(optional)</span>
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
          className={cn(
            field,
            "min-h-40 resize-y font-mono text-[12px] leading-relaxed",
          )}
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
          className={cn(
            "whitespace-pre-wrap text-[12px]",
            problem ? "font-mono text-danger-fg" : "text-subtle",
          )}
        >
          {problem ??
            "Paste a Shadertoy-style mainImage function. iResolution, iTime, and iFrame are available. The image above stays as the fallback and the link preview."}
        </span>
        {!text ? (
          <button
            type="button"
            className={cn(btnGhost, "self-start")}
            onClick={() => setText(SHADER_STARTER)}
          >
            Start from an example
          </button>
        ) : null}
      </div>
    </details>
  );
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

type Created = { url: string };

function embedSnippet(path: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  return `<iframe src="${origin}/embed/${slug}" width="100%" height="480" style="border:0" title="NodeVault graph"></iframe>`;
}

const label = "flex flex-col gap-2 text-[13px] font-medium text-fg";

export function ShareSheet({
  payload,
  onClose,
  restored = null,
}: {
  payload: NodeVaultPayload;
  onClose: (publishedUrl?: string) => void;
  restored?: ShareDraft | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [visibility, setVisibility] = useState<"public" | "unlisted">(
    restored?.visibility ?? "public",
  );
  const [tags, setTags] = useState(() =>
    (restored?.tags ?? "").split(",").map(tagToken).filter(Boolean),
  );
  const [coverName, setCoverName] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [shaderProblem, setShaderProblem] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInPresent, setSignInPresent] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const mod = useModKey();
  const { data: session } = useServerSession();
  const handle = session?.user.handle;

  useEffect(() => {
    if (signInOpen) return;
    const id = window.setTimeout(() => setSignInPresent(false), 200);
    return () => window.clearTimeout(id);
  }, [signInOpen]);

  const showCover = useCallback((file: File | null) => {
    setCoverError(null);
    setCoverName(file?.name ?? null);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      if (!data || created) return;
      const image = [...data.files].find((f) => f.type.startsWith("image/"));
      if (!image) return;
      if (isTextField(event.target) && data.getData("text/plain").trim())
        return;
      event.preventDefault();
      event.stopPropagation();
      const input = coverRef.current;
      if (!COVER_TYPES.includes(image.type) || !input) {
        setCoverError(
          "That image type can’t be used. Paste a JPEG, PNG, WebP, or GIF.",
        );
        return;
      }
      const named = new File(
        [image],
        image.name && image.name !== "image.png"
          ? image.name
          : pastedName(image.type),
        {
          type: image.type,
        },
      );
      const transfer = new DataTransfer();
      transfer.items.add(named);
      input.files = transfer.files;
      showCover(named);
    };
    window.addEventListener("paste", onPaste, { capture: true });
    return () =>
      window.removeEventListener("paste", onPaste, { capture: true });
  }, [created, showCover]);

  const count = payload.origin.node_count;
  const typeLabel = treeTypeLabel(payload.tree_type);
  const defaultTitle = `${count} ${typeLabel.toLowerCase()} node${count === 1 ? "" : "s"}`;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  if (created) {
    return (
      <Dialog title="It’s live." onClose={() => onClose(created.url)}>
        <div className="flex flex-col gap-4 px-5 py-5">
          <p className="m-0 text-[15px] leading-relaxed text-muted">
            {visibility === "unlisted"
              ? "Anyone with the link can open the graph. It will not appear in the gallery."
              : "Anyone with the link can open the graph and copy it into Blender. It is in the gallery."}
          </p>
          <a
            className="break-all rounded-md border border-line-strong bg-bg px-3 py-2.5 font-mono text-[12px] text-fg no-underline"
            href={created.url}
          >
            {created.url}
          </a>
          <label className={label}>
            Embed
            <textarea
              className={cn(field, "font-mono text-[12px]")}
              readOnly
              rows={3}
              value={embedSnippet(created.url)}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <a className={cn(btnAccent, "py-2.5")} href={created.url}>
            Open post
          </a>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Share this graph"
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-x-2 tabular-nums">
          <span
            className={treeDotClass(payload.tree_type)}
            aria-hidden="true"
          />
          {typeLabel} · Blender {payload.blender_version_string} · {count} node
          {count === 1 ? "" : "s"}
        </span>
      }
      onClose={() => onClose()}
      wide
    >
      <form
        ref={formRef}
        className="flex min-h-0 flex-1 flex-col"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.tagName === "TEXTAREA") return;
          if (target instanceof HTMLButtonElement && target.type === "submit")
            return;
          event.preventDefault();
        }}
        onSubmit={(event) => {
          console.log("onSubmit");
          event.preventDefault();
          const form = event.currentTarget;
          const submitted = new FormData(form);
          const pending =
            form.querySelector<HTMLInputElement>("[data-tag-draft]");
          submitted.set("tags", addTag(tags, pending?.value ?? "").join(","));
          const badLink = LINKS.find(
            (l) => !linkIsValid(l, String(submitted.get(l.name) ?? "")),
          );
          if (badLink) {
            setError(badLink.invalid);
            form
              .querySelector<HTMLInputElement>(`[name="${badLink.name}"]`)
              ?.focus();
            return;
          }
          if (shaderProblem) {
            setError(`The cover shader has a problem: ${shaderProblem}`);
            form
              .querySelector<HTMLTextAreaElement>('[name="cover_shader"]')
              ?.focus();
            return;
          }
          const treeText = serializeCopy(payload);
          const cover = submitted.get("cover");
          setBusy(true);
          setError(null);
          void (async () => {
            const body = submitted;
            body.set("tree_text", treeText);
            const chosen =
              cover instanceof File && cover.size > 0
                ? cover
                : await captureNodeCanvas();
            body.set(
              "cover",
              await fitCoverFile(
                chosen,
                coverByteBudget(new Blob([treeText]).size),
              ),
            );
            const payloadBytes = (await new Response(body).blob()).size;
            console.log(payloadBytes / 1024 / 1024);
            console.log(
              [...body.entries()].map(([name, value]) => ({
                name,
                mb:
                  (value instanceof Blob
                    ? value.size
                    : new Blob([String(value)]).size) /
                  1024 /
                  1024,
                ...(value instanceof File
                  ? { file: value.name, type: value.type }
                  : { chars: String(value).length }),
              })),
            );
            const createdPost = await publishPost(body);
            if ("error" in createdPost) {
              setError(createdPost.error);
              return;
            }
            setCreated({ url: createdPost.url });
          })()
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : "";
              setError(
                publishFailureMessage(0, message) ??
                  (message ||
                    "Could not reach the server. Check your connection and try again."),
              );
            })
            .finally(() => setBusy(false));
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 py-5">
          <label className={label}>
            Cover image
            <span
              className={cn(
                "relative block overflow-hidden rounded-lg border border-dashed border-line-strong bg-sunken text-center text-[13px] font-normal text-muted transition-colors duration-150 has-[:focus-visible]:border-accent hover:border-subtle",
                coverPreview ? "aspect-video" : "px-4 py-8",
              )}
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <>
                  <span className="block text-fg">
                    Choose a render or screenshot
                  </span>
                  <span className="mt-1 block text-subtle">
                    or paste one with <Kbd>{`${mod} V`}</Kbd>. Skip it to use
                    the graph.
                  </span>
                </>
              )}
              <input
                ref={coverRef}
                className="absolute inset-0 cursor-pointer opacity-0"
                name="cover"
                type="file"
                accept={COVER_TYPES.join(",")}
                aria-describedby="cover-name"
                onChange={(event) => showCover(event.target.files?.[0] ?? null)}
              />
            </span>
            <span
              id="cover-name"
              role={coverError ? "alert" : undefined}
              className={cn(
                "text-[12px] font-normal",
                coverError ? "text-danger-fg" : "text-subtle",
              )}
            >
              {coverError ??
                (coverName
                  ? `${coverName} · paste another image to replace it`
                  : "Optional. Leave this empty and the node graph on screen is saved as the cover.")}
            </span>
          </label>

          <ShaderField
            poster={coverPreview}
            onProblem={setShaderProblem}
            initial={restored?.cover_shader ?? ""}
          />

          <label className={label}>
            Title
            <input
              ref={titleRef}
              className={field}
              name="title"
              required
              maxLength={120}
              defaultValue={restored?.title || defaultTitle}
            />
          </label>
          {handle ? (
            <p className="m-0 text-[13px] text-muted">
              Posting as <span className="text-fg">@{handle}</span>
            </p>
          ) : (
            <div className="rounded-lg border border-line bg-bg p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-[13px] leading-relaxed text-muted">
                  This post stays anonymous. Sign in if you want it under your
                  handle.
                </p>
                <button
                  type="button"
                  className={cn(btn, "shrink-0")}
                  aria-expanded={signInOpen}
                  aria-controls="share-sign-in"
                  onClick={() => {
                    setSignInOpen((open) => !open);
                    setSignInPresent(true);
                  }}
                >
                  Sign in
                </button>
              </div>
              <div
                id="share-sign-in"
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out-quart motion-reduce:transition-none",
                  signInOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div
                  className="min-h-0 overflow-hidden"
                  inert={signInOpen ? undefined : true}
                >
                  {signInPresent ? (
                    <div className="pt-3">
                      <SignInButtons
                        callbackURL="/paste"
                        onBefore={() => {
                          const form = formRef.current;
                          const value = (name: string) => {
                            const el = form?.elements.namedItem(name);
                            return el instanceof HTMLInputElement ||
                              el instanceof HTMLTextAreaElement ||
                              el instanceof HTMLSelectElement
                              ? el.value
                              : "";
                          };
                          const draft: ShareDraft = {
                            treeText: serializeCopy(payload),
                            title: value("title"),
                            author: "",
                            description: value("description"),
                            youtube_url: value("youtube_url"),
                            tweet_url: value("tweet_url"),
                            cover_shader: value("cover_shader"),
                            visibility,
                            tags: tags.join(","),
                          };
                          sessionStorage.setItem(
                            SHARE_DRAFT_KEY,
                            JSON.stringify(draft),
                          );
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          <div className={label}>
            <label htmlFor="post-description">
              Note{" "}
              <span className="font-normal text-subtle">
                (optional, markdown)
              </span>
            </label>
            <MarkdownField
              id="post-description"
              name="description"
              defaultValue={restored?.description ?? ""}
              placeholder="What should someone know before they paste this?"
            />
          </div>
          <div className={label}>
            <span>
              Tags <span className="font-normal text-subtle">(optional)</span>
            </span>
            <input type="hidden" name="tags" value={tags.join(",")} />
            <TagPills tags={tags} onChange={setTags} />
            <span className="text-[12px] font-normal text-subtle">
              Press Enter to add a tag.
            </span>
          </div>
          <label className={label}>
            Visibility
            <select
              className={field}
              name="visibility"
              value={visibility}
              onChange={(event) =>
                setVisibility(
                  event.target.value === "unlisted" ? "unlisted" : "public",
                )
              }
            >
              <option value="public">Public — listed in the gallery</option>
              <option value="unlisted">
                Unlisted — only people with the link
              </option>
            </select>
          </label>

          <fieldset className="m-0 flex flex-col gap-4 border-0 border-t border-line p-0 pt-5">
            <legend className="float-left mb-1 w-full p-0 text-[13px] font-medium text-fg">
              Links <span className="font-normal text-subtle">(optional)</span>
              <span className="mt-1 block text-[12px] font-normal text-subtle">
                A breakdown video or the post where you showed it off. Either,
                both, or neither.
              </span>
            </legend>
            {LINKS.map((spec) => (
              <LinkField
                key={spec.name}
                spec={spec}
                defaultValue={restored?.[spec.name] ?? ""}
              />
            ))}
          </fieldset>

          {error ? (
            <p role="alert" className={cn(errorBox, "m-0")}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" className={btn} onClick={() => onClose()}>
            Not now
          </button>
          <button
            type="submit"
            className={cn(btnAccent, "px-5")}
            disabled={busy}
          >
            {busy ? <InlineLoader mono label="Publishing" /> : "Publish"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
