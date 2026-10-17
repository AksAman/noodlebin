import { GallerySkeleton, InlineLoader } from "@/components/Loader"
import { docShell, page } from "@/lib/ui"

export default function Loading() {
  return (
    <div className={docShell}>
      <div className={page}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line pb-8 pt-14 sm:pt-20">
          <span aria-hidden="true" className="size-16 rounded-full bg-sunken ring-1 ring-line" />
          <div className="min-w-0">
            <span aria-hidden="true" className="block h-10 w-56 rounded bg-sunken" />
            <InlineLoader label="Loading graphs" className="mt-3 text-[14px] text-muted" />
          </div>
        </header>
        <div className="loader-reveal pt-10">
          <GallerySkeleton />
        </div>
      </div>
    </div>
  )
}
