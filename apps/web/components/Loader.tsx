import { cn } from "@/lib/ui"
import type { CSSProperties } from "react"

const NOODLE_SIZE = { sm: "h-3 w-[25px]", md: "h-4 w-[34px]", lg: "h-7 w-[60px]" } as const

/**
 * The noodlebin mark as a loader: the noodle draws from the output socket and drops
 * into the bin on the right, which lights up when it lands, then lets go and starts over.
 * `mono` paints everything in currentColor, for use on filled buttons.
 */
export function Noodle({
  size = "md",
  mono = false,
  className,
}: {
  size?: keyof typeof NOODLE_SIZE
  mono?: boolean
  className?: string | undefined
}) {
  const binColor = mono ? "currentColor" : "var(--tree-geometry)"
  return (
    <svg viewBox="0 0 34 16" aria-hidden="true" className={cn("noodle shrink-0 overflow-visible", NOODLE_SIZE[size], className)}>
      {/* noodle link */}
      <path
        d="M4.5 4.5C13 4.5 15 11.5 23 11.5"
        style={{ "--len": 20 } as CSSProperties}
        fill="none"
        stroke={mono ? "currentColor" : "var(--tree-shader)"}
        strokeWidth="2"
        strokeLinecap="round"
        className="noodle-link"
      />
      {/* output socket */}
      <circle cx="4.5" cy="4.5" r="3" fill={mono ? "currentColor" : "var(--accent)"} className="noodle-out" />
      {/* bin — lights up like the old input socket */}
      <rect x="21" y="9.5" width="6" height="5" fill="none" stroke={binColor} strokeWidth="1.5" strokeLinejoin="round" className="noodle-in" />
      <line x1="20" y1="9.5" x2="28" y2="9.5" stroke={binColor} strokeWidth="1.5" strokeLinecap="round" className="noodle-in" />
    </svg>
  )
}

/** A noodle with a short label, for buttons and small regions. */
export function InlineLoader({
  label,
  mono = false,
  className,
}: {
  label: string
  mono?: boolean
  className?: string | undefined
}) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <Noodle size="sm" mono={mono} />
      <span>{label}</span>
    </span>
  )
}

/**
 * Fills its container: a dim halftone field with a ring of dots swelling outward from the noodle.
 * Fades in after a short delay so quick loads never flash it.
 */
export function PageLoader({ label = "Loading", className }: { label?: string; className?: string | undefined }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("loader-field relative flex flex-1 items-center justify-center overflow-hidden", className)}
    >
      <div className="loader-reveal relative flex flex-col items-center gap-4">
        <Noodle size="lg" />
        <span className="text-[13px] tracking-wide text-muted">{label}</span>
      </div>
    </div>
  )
}

const GHOST_TREES = ["var(--tree-shader)", "var(--tree-geometry)", "var(--tree-compositor)"] as const

/** A ghost node card whose rows fill in one after another, like Blender evaluating it. */
export function GhostNode({
  rows = 3,
  tree = 0,
  delay = 0,
  className,
  style,
}: {
  rows?: number
  tree?: number
  delay?: number
  className?: string | undefined
  style?: CSSProperties | undefined
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("ghost-node w-[140px] overflow-hidden rounded-[5px] border border-white/10 bg-[#2b2b2b]", className)}
      style={{ ...style, animationDelay: `${delay}ms` }}
    >
      <div className="h-5" style={{ background: `color-mix(in oklab, ${GHOST_TREES[tree % 3]} 55%, #2b2b2b)` }} />
      <div className="flex flex-col gap-[5px] px-1.5 py-2">
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className="ghost-row block h-[14px] rounded-[3px] bg-white/[0.06]" style={{ animationDelay: `${delay + i * 140}ms` }} />
        ))}
      </div>
    </div>
  )
}

/** Placeholder cards with the gallery's rhythm, so the layout doesn't jump when covers arrive. */
export function GallerySkeleton({ count = 6 }: { count?: number }) {
  const heights = ["aspect-[4/3]", "aspect-[16/10]", "aspect-square", "aspect-[4/3]", "aspect-[3/4]", "aspect-[16/9]"]
  return (
    <ul aria-hidden="true" className="m-0 list-none columns-1 gap-x-6 p-0 sm:columns-2 lg:columns-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="mb-10 break-inside-avoid">
          <div className={cn("loader-field rounded-lg ring-1 ring-line", heights[i % heights.length])} />
          <span className="mt-3.5 block h-[18px] w-3/5 rounded bg-sunken" />
          <span className="mt-2 block h-3 w-2/5 rounded bg-sunken" />
        </li>
      ))}
    </ul>
  )
}
