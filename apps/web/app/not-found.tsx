import { cn, page, docShell } from "@/lib/ui"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className={docShell}>
      <div className={cn(page, "pt-20 sm:pt-28")}>
        <p className="m-0 text-[13px] text-subtle tabular-nums">404</p>
        <h1 className="mt-3 max-w-[16ch] font-display text-[clamp(2.25rem,1.6rem+3vw,4rem)] font-semibold leading-[1] tracking-[-0.035em] text-fg">
          This link doesn’t lead to a graph.
        </h1>
        <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-muted">
          It may have been mistyped, or the post was removed.
        </p>
        <Link className="mt-8 inline-block text-accent-fg underline-offset-4 hover:underline" href="/">
          Back to the gallery
        </Link>
      </div>
    </div>
  )
}
