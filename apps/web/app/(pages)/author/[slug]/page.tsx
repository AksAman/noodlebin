import { CoverGrid } from "@/components/CoverGrid"
import { getRequestSession } from "@/lib/auth"
import { profileByHandle } from "@/lib/profile"
import { authorGallery } from "@/lib/store"
import { docShell, page } from "@/lib/ui"
import { BRAND_NAME } from "@/lib/brand"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [profile, list] = await Promise.all([profileByHandle(slug), authorGallery(slug, false)])
  if (!profile && list.length === 0) return { title: "Not found" }
  const name = profile?.name ?? list[0]?.author_name ?? `@${slug}`
  return { title: `${name} · ${BRAND_NAME}` }
}

export default async function AuthorRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [profile, session] = await Promise.all([profileByHandle(slug), getRequestSession()])
  const isOwner = Boolean(profile && session?.user?.id && session.user.id === profile.id)
  const list = await authorGallery(slug, isOwner)
  if (!profile && list.length === 0) notFound()

  const name = profile?.name ?? list[0]?.author_name ?? `@${slug}`
  const image = profile?.image

  return (
    <div className={docShell}>
      <div className={page}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line pb-8 pt-14 sm:pt-20">
          {image ? (
            <img src={image} alt="" className="size-16 rounded-full object-cover ring-1 ring-line" />
          ) : (
            <div
              aria-hidden="true"
              className="grid size-16 place-items-center rounded-full bg-sunken font-display text-2xl font-semibold uppercase text-muted ring-1 ring-line"
            >
              {name.replace(/^@/, "").slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-semibold leading-none tracking-[-0.03em] text-fg">
              {name}
            </h1>
            <p className="mt-2 text-[14px] text-muted tabular-nums">
              @{profile?.handle ?? slug}
              {" · "}
              {list.length} graph{list.length === 1 ? "" : "s"}
            </p>
          </div>
        </header>
        {list.length > 0 ? (
          <div className="pt-10">
            <CoverGrid posts={list} showAuthor={false} />
          </div>
        ) : (
          <div className="py-16">
            <p className="m-0 font-display text-2xl text-fg">No graphs from @{slug} yet.</p>
            <p className="mt-2 text-muted">
              <Link className="text-accent-fg underline-offset-4 hover:underline" href="/">
                Browse the gallery
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
