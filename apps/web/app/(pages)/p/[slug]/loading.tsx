import { GhostNode, Noodle } from "@/components/Loader"
import { canvas, cn } from "@/lib/ui"
import type { CSSProperties } from "react"

const NODES = [
  { x: 0, y: 46, rows: 3, tree: 2, delay: 0 },
  { x: 190, y: 0, rows: 4, tree: 0, delay: 120 },
  { x: 190, y: 156, rows: 2, tree: 1, delay: 240 },
  { x: 380, y: 64, rows: 3, tree: 0, delay: 360 },
  { x: 560, y: 92, rows: 2, tree: 0, delay: 480 },
]

const LINKS = [
  { d: "M140 86 C165 86 165 40 190 40", len: 75 },
  { d: "M140 96 C165 96 165 186 190 186", len: 110 },
  { d: "M330 40 C355 40 355 104 380 104", len: 88 },
  { d: "M330 186 C355 186 355 114 380 114", len: 95 },
  { d: "M520 104 C540 104 540 122 560 122", len: 46 },
]

export default function Loading() {
  return (
    <div data-fullbleed className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <aside
        aria-hidden="true"
        className="flex shrink-0 flex-col gap-6 border-line px-5 py-7 sm:px-8 md:w-[340px] md:border-r md:px-6 lg:w-[380px] lg:px-7"
      >
        <div className="loader-field relative aspect-[4/3] rounded-lg ring-1 ring-line" />
        <div>
          <span className="block h-8 w-4/5 rounded bg-sunken" />
          <span className="mt-3 block h-3.5 w-1/3 rounded bg-sunken" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="block h-3.5 w-full rounded bg-sunken" />
          <span className="block h-3.5 w-11/12 rounded bg-sunken" />
          <span className="block h-3.5 w-2/3 rounded bg-sunken" />
        </div>
        <span className="block h-12 w-full rounded-lg bg-sunken" />
      </aside>

      <div className={cn(canvas, "flex min-h-[70vh] items-center justify-center overflow-hidden md:min-h-0")} data-theme="dark">
        <div role="status" aria-live="polite" className="loader-reveal flex flex-col items-center gap-8">
          <div className="relative h-[240px] w-[700px] shrink-0 [zoom:0.5] sm:[zoom:0.75] lg:[zoom:1]">
            <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 700 240" aria-hidden="true">
              {LINKS.map(({ d, len }, i) => (
                <path
                  key={d}
                  d={d}
                  fill="none"
                  stroke="rgb(255 255 255 / 22%)"
                  strokeWidth="2"
                  className="noodle-link"
                  style={{ "--len": len, animationDelay: `${i * 160}ms` } as CSSProperties}
                />
              ))}
            </svg>
            {NODES.map((n) => (
              <GhostNode key={n.x + n.y} rows={n.rows} tree={n.tree} delay={n.delay} className="absolute" style={{ left: n.x, top: n.y }} />
            ))}
          </div>
          <span className="flex items-center gap-2.5 text-[13px] tracking-wide text-[#a3a3a3]">
            <Noodle size="sm" />
            Loading graph
          </span>
        </div>
      </div>
    </div>
  )
}
