import { CoverGrid } from "@/components/CoverGrid";
import { GallerySearch } from "@/components/GallerySearch";
import { HeroShader } from "@/components/HeroShader";
import { filterPosts, HOMEPAGE_NOISE_SLUG } from "@/lib/posts";
import { allPublicPosts } from "@/lib/store";
import {
  btnAccent,
  cn,
  container,
  docShell,
  page,
  treeDotClass,
} from "@/lib/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "", label: "All" },
  { id: "ShaderNodeTree", label: "Shader" },
  { id: "GeometryNodeTree", label: "Geometry" },
  { id: "CompositorNodeTree", label: "Compositor" },
] as const;

function galleryHref(next: { tree?: string; q?: string; tag?: string; page?: number }): string {
  const params = new URLSearchParams();
  if (next.tree) params.set("tree", next.tree);
  if (next.q) params.set("q", next.q);
  if (next.tag) params.set("tag", next.tag);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

const PAGE_SIZE = 12;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tree?: string; q?: string; tag?: string; page?: string }>;
}) {
  const { tree = "", q = "", tag = "", page: pageRaw = "" } = await searchParams;
  const all = await allPublicPosts();
  const base = filterPosts(all, { tree_type: tree || null, q });
  const list = tag ? filterPosts(base, { tag }) : base;
  const tagOptions = [...new Set(base.flatMap((post) => post.tags))].sort();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, Number(pageRaw) || 1));
  const visible = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className={docShell}>
      <section className="relative isolate">
        <HeroShader className="absolute inset-0 -z-10 size-full" />
        <header
          className={cn(
            container,
            "grid gap-x-12 gap-y-6 pb-16 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end",
          )}
        >
          <div>
            <h1 className="m-0 max-w-[14ch] font-display text-[clamp(2.75rem,1.6rem+4.4vw,5.25rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-fg">
              Steal these graphs.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted">
              Every graph here copies straight back into Blender with its
              values, links, frames, and groups intact.
            </p>
            <Link
              className="group mt-6 inline-flex items-center gap-2 text-[12px] text-subtle no-underline transition-colors duration-150 hover:text-fg"
              href={`/p/${HOMEPAGE_NOISE_SLUG}`}
            >
              <span
                className={treeDotClass("ShaderNodeTree")}
                aria-hidden="true"
              />
              The dots behind this are a Blender shader.
              <span className="text-accent-fg underline-offset-4 group-hover:underline">
                Copy the nodes
              </span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 justify-self-start lg:self-end">
            <Link
              className={cn(btnAccent, "px-4 py-2.5 text-[14px]")}
              href="/paste"
            >
              Paste your own
            </Link>
            <Link
              className="text-[14px] text-muted underline-offset-4 hover:text-fg hover:underline"
              href="/addon"
            >
              Get the Blender add-on
            </Link>
          </div>
        </header>
      </section>

      <div className={page}>
        <nav
          aria-label="Filter by tree type"
          className="mb-8 flex flex-wrap items-center gap-1.5  pt-5"
        >
          {FILTERS.map((f) => {
            const active = tree === f.id;
            return (
              <Link
                key={f.id}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] no-underline transition-colors duration-150",
                  active
                    ? "border-fg bg-fg text-bg"
                    : "border-line text-muted hover:border-line-strong hover:text-fg",
                )}
                href={galleryHref({ tree: f.id, q, tag })}
              >
                {f.id ? (
                  <span className={treeDotClass(f.id)} aria-hidden="true" />
                ) : null}
                {f.label}
              </Link>
            );
          })}
          <span className="ml-auto text-[13px] text-subtle tabular-nums">
            {list.length} graph{list.length === 1 ? "" : "s"}
          </span>
        </nav>
        <GallerySearch tree={tree} tag={tag} q={q} />
        {tagOptions.length > 0 ? (
          <div className="mb-8 flex flex-wrap gap-1.5">
            {tagOptions.map((option) => {
              const active = tag === option;
              const href = galleryHref({ tree, q, tag: active ? "" : option });
              return (
                <Link
                  key={option}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] no-underline",
                    active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg",
                  )}
                >
                  {option}
                </Link>
              );
            })}
          </div>
        ) : null}

        {list.length > 0 ? (
          <CoverGrid posts={visible} />
        ) : (
          <div className="py-16">
            <p className="m-0 font-display text-2xl text-fg">
              {q || tag ? "Nothing matches." : "Nothing here yet."}
            </p>
            <p className="mt-2 text-muted">
              {q || tag ? (
                "Try another word, or clear the search."
              ) : (
                <>
                  No graphs of this type have been shared.{" "}
                  <Link
                    className="text-accent-fg underline-offset-4 hover:underline"
                    href="/paste"
                  >
                    Paste one
                  </Link>{" "}
                  and be the first.
                </>
              )}
            </p>
          </div>
        )}
        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-center gap-3 text-[13px]">
            {current > 1 ? (
              <Link
                className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-fg no-underline hover:border-subtle"
                href={galleryHref({ tree, q, tag, page: current - 1 })}
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-line px-3 py-1.5 text-subtle">Previous</span>
            )}
            <span className="tabular-nums text-muted">
              {current} of {pages}
            </span>
            {current < pages ? (
              <Link
                className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-fg no-underline hover:border-subtle"
                href={galleryHref({ tree, q, tag, page: current + 1 })}
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-line px-3 py-1.5 text-subtle">Next</span>
            )}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
