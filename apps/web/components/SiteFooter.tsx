"use client"

import { XGlyph } from "@/components/PostEmbeds"
import { Mark } from "@/components/SiteNav"
import { creator } from "@/lib/creator"
import { cn } from "@/lib/ui"
import Link from "next/link"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react"

type NodeId = "vault" | "creator"
type Vec = { x: number; y: number }
type Body = { pos: Vec; vel: Vec; tilt: number }
type Wire = { d: string; x1: number; y1: number; x2: number; y2: number }

const IDS: NodeId[] = ["vault", "creator"]
/** Per-16ms velocity retained after friction, and energy kept on a wall bounce. */
const FRICTION = 0.94
const BOUNCE = 0.55
const EDGE = 10

const rest = (): Record<NodeId, Body> => ({
  vault: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, tilt: 0 },
  creator: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, tilt: 0 },
})

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function Socket({ side, color, pinged, socketRef }: { side: "in" | "out"; color: string; pinged: boolean; socketRef: Ref<HTMLSpanElement> }) {
  return (
    <span
      ref={socketRef}
      aria-hidden="true"
      className={cn(
        "absolute top-1/2 size-3 -translate-y-1/2 rounded-full ring-2 ring-surface",
        side === "out" ? "-right-[7px]" : "-left-[7px]",
        color,
        pinged && "footer-ping",
      )}
    />
  )
}

function NodeHeader({ tint, children }: { tint: string; children: ReactNode }) {
  return (
    <div className={cn("flex touch-none items-center gap-2 rounded-t-[7px] border-b border-line px-3.5 py-2.5", tint)}>
      {children}
      <svg viewBox="0 0 10 16" aria-hidden="true" className="ml-auto h-3.5 w-2.5 text-subtle">
        {[3, 8, 13].flatMap((cy) => [
          <circle key={`l${cy}`} cx="2.5" cy={cy} r="1.3" fill="currentColor" />,
          <circle key={`r${cy}`} cx="7.5" cy={cy} r="1.3" fill="currentColor" />,
        ])}
      </svg>
    </div>
  )
}

export function SiteFooter() {
  const stage = useRef<HTMLDivElement>(null)
  const nodes = useRef<Record<NodeId, HTMLDivElement | null>>({ vault: null, creator: null })
  const outSocket = useRef<HTMLSpanElement>(null)
  const inSocket = useRef<HTMLSpanElement>(null)
  const bodies = useRef(rest())
  const drag = useRef<{ id: NodeId; pointer: number; px: number; py: number; ox: number; oy: number; lx: number; ly: number; lt: number } | null>(null)
  const frame = useRef(0)
  const tracking = useRef(0)

  const [, setTick] = useState(0)
  const [wire, setWire] = useState<Wire | null>(null)
  const [visible, setVisible] = useState(false)
  const [hot, setHot] = useState(false)
  const [active, setActive] = useState<NodeId | null>(null)
  const [front, setFront] = useState<NodeId>("creator")
  const [settling, setSettling] = useState(false)
  const [moved, setMoved] = useState(false)

  const render = useCallback(() => setTick((t) => t + 1), [])

  const measure = useCallback(() => {
    const s = stage.current?.getBoundingClientRect()
    const a = outSocket.current?.getBoundingClientRect()
    const b = inSocket.current?.getBoundingClientRect()
    if (!s || !a || !b) return
    const x1 = a.left + a.width / 2 - s.left
    const y1 = a.top + a.height / 2 - s.top
    const x2 = b.left + b.width / 2 - s.left
    const y2 = b.top + b.height / 2 - s.top
    const dx = Math.max(56, Math.abs(x2 - x1) * 0.5)
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
    setWire((prev) => (prev?.d === d ? prev : { d, x1, y1, x2, y2 }))
  }, [])

  /** Re-measure every frame while CSS is animating the nodes, so the wire stays attached. */
  const track = useCallback(
    (ms: number) => {
      const until = performance.now() + ms
      cancelAnimationFrame(tracking.current)
      const tick = () => {
        measure()
        if (performance.now() < until) tracking.current = requestAnimationFrame(tick)
      }
      tick()
    },
    [measure],
  )

  /** How far a node may travel from its layout position before it leaves the stage. */
  const bounds = useCallback((id: NodeId) => {
    const el = nodes.current[id]
    const s = stage.current
    if (!el || !s) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    return {
      minX: EDGE - el.offsetLeft,
      maxX: s.clientWidth - EDGE - el.offsetLeft - el.offsetWidth,
      minY: EDGE - el.offsetTop,
      maxY: s.clientHeight - EDGE - el.offsetTop - el.offsetHeight,
    }
  }, [])

  const simulate = useCallback(() => {
    cancelAnimationFrame(frame.current)
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      let busy = false
      for (const id of IDS) {
        if (drag.current?.id === id) {
          busy = true
          continue
        }
        const body = bodies.current[id]
        const b = bounds(id)
        body.pos.x += body.vel.x * dt
        body.pos.y += body.vel.y * dt
        if (body.pos.x < b.minX || body.pos.x > b.maxX) {
          body.pos.x = Math.max(b.minX, Math.min(b.maxX, body.pos.x))
          body.vel.x *= -BOUNCE
        }
        if (body.pos.y < b.minY || body.pos.y > b.maxY) {
          body.pos.y = Math.max(b.minY, Math.min(b.maxY, body.pos.y))
          body.vel.y *= -BOUNCE
        }
        const decay = Math.pow(FRICTION, dt / 16)
        body.vel.x *= decay
        body.vel.y *= decay
        body.tilt *= Math.pow(0.82, dt / 16)
        if (Math.hypot(body.vel.x, body.vel.y) < 0.01) body.vel = { x: 0, y: 0 }
        if (Math.abs(body.tilt) < 0.05) body.tilt = 0
        if (body.vel.x || body.vel.y || body.tilt) busy = true
      }
      render()
      if (busy) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [bounds, render])

  useLayoutEffect(() => {
    measure()
  })

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const resize = new ResizeObserver(() => {
      for (const id of IDS) {
        const body = bodies.current[id]
        const b = bounds(id)
        body.pos.x = Math.max(b.minX, Math.min(b.maxX, body.pos.x))
        body.pos.y = Math.max(b.minY, Math.min(b.maxY, body.pos.y))
      }
      render()
    })
    resize.observe(el)
    void document.fonts?.ready.then(() => measure())
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        track(900)
        seen.disconnect()
      },
      { threshold: 0.3 },
    )
    seen.observe(el)
    return () => {
      resize.disconnect()
      seen.disconnect()
      cancelAnimationFrame(frame.current)
      cancelAnimationFrame(tracking.current)
    }
  }, [bounds, measure, render, track])

  const grab = (id: NodeId) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || drag.current) return
    if ((e.target as Element).closest("a, button")) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety; dragging still works without it */
    }
    const body = bodies.current[id]
    body.vel = { x: 0, y: 0 }
    drag.current = { id, pointer: e.pointerId, px: e.clientX, py: e.clientY, ox: body.pos.x, oy: body.pos.y, lx: e.clientX, ly: e.clientY, lt: e.timeStamp }
    setSettling(false)
    setActive(id)
    setFront(id)
    setMoved(true)
    simulate()
  }

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const body = bodies.current[d.id]
    const b = bounds(d.id)
    body.pos.x = Math.max(b.minX, Math.min(b.maxX, d.ox + e.clientX - d.px))
    body.pos.y = Math.max(b.minY, Math.min(b.maxY, d.oy + e.clientY - d.py))
    const dt = Math.max(1, e.timeStamp - d.lt)
    const vx = (e.clientX - d.lx) / dt
    const vy = (e.clientY - d.ly) / dt
    body.vel.x = body.vel.x * 0.6 + vx * 0.4
    body.vel.y = body.vel.y * 0.6 + vy * 0.4
    body.tilt = reducedMotion() ? 0 : Math.max(-10, Math.min(10, body.vel.x * 9))
    d.lx = e.clientX
    d.ly = e.clientY
    d.lt = e.timeStamp
    render()
  }

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    drag.current = null
    setActive(null)
    const body = bodies.current[d.id]
    if (reducedMotion() || e.timeStamp - d.lt > 80) body.vel = { x: 0, y: 0 }
    simulate()
  }

  const tidy = () => {
    cancelAnimationFrame(frame.current)
    bodies.current = rest()
    setSettling(true)
    setMoved(false)
    render()
    track(800)
  }

  const year = new Date().getFullYear()

  const draggable = (id: NodeId, className: string, children: ReactNode, delay?: string) => {
    const body = bodies.current[id]
    const lifted = active === id
    return (
      <div
        ref={(el) => {
          nodes.current[id] = el
        }}
        className={cn(
          "relative w-full select-none",
          lifted ? "cursor-grabbing" : "cursor-grab",
          front === id ? "z-20" : "z-10",
          settling && "motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out-expo",
          className,
        )}
        style={{ transform: `translate(${body.pos.x}px, ${body.pos.y}px) rotate(${body.tilt}deg) scale(${lifted ? 1.03 : 1})` }}
        onPointerDown={grab(id)}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onTransitionEnd={() => setSettling(false)}
      >
        <div
          className={cn(
            "rounded-lg border bg-surface transition-shadow duration-200",
            lifted
              ? "border-subtle shadow-[0_28px_60px_-20px_rgb(0_0_0_/_60%)]"
              : "border-line-strong shadow-[0_18px_40px_-24px_rgb(0_0_0_/_45%)]",
            visible ? cn("motion-safe:animate-rise", delay) : "motion-safe:opacity-0",
          )}
        >
          {children}
        </div>
      </div>
    )
  }

  return (
    <footer className="site-footer shrink-0 border-t border-line bg-sunken">
      <div className="mx-auto w-full max-w-[1240px] px-5 pt-14 pb-8 sm:px-8 sm:pt-16">
        <div
          ref={stage}
          data-hot={hot || active !== null || undefined}
          className="footer-stage relative flex flex-col gap-16 overflow-hidden rounded-xl border border-line p-5 sm:p-8 md:min-h-[440px] md:flex-row md:items-start md:justify-between"
        >
          <div className="pointer-events-none absolute right-4 bottom-3 z-30 text-[12px] text-subtle sm:right-5 sm:bottom-4">
            {moved ? null : <span className={cn("transition-opacity duration-500", visible ? "opacity-100" : "opacity-0")}>Grab a node. Throw it.</span>}
          </div>
          {moved ? (
            <button
              type="button"
              onClick={tidy}
              className="absolute right-3 bottom-3 z-30 cursor-pointer rounded-md border border-line-strong bg-surface px-2.5 py-1 text-[12px] text-muted transition-colors duration-150 hover:text-fg sm:right-4 sm:bottom-4"
            >
              Tidy up
            </button>
          ) : null}

          {wire ? (
            <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible">
              <defs>
                <linearGradient id="footer-wire" gradientUnits="userSpaceOnUse" x1={wire.x1} y1={wire.y1} x2={wire.x2} y2={wire.y2}>
                  <stop offset="0" stopColor="var(--accent)" />
                  <stop offset="1" stopColor="var(--tree-geometry)" />
                </linearGradient>
              </defs>
              <path
                className={cn("transition-opacity duration-500", !visible && "motion-safe:opacity-0")}
                d={wire.d}
                fill="none"
                stroke="var(--line)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                className="footer-wire"
                d={wire.d}
                fill="none"
                stroke="url(#footer-wire)"
                strokeWidth="2.5"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={visible ? 0 : 1}
              />
              <path
                className={cn("footer-flow", visible && "is-on")}
                d={wire.d}
                fill="none"
                stroke="var(--surface)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="0.01 18"
              />
            </svg>
          ) : null}

          {draggable(
            "vault",
            "max-w-[280px] self-start",
            <>
              <NodeHeader tint="bg-[color-mix(in_oklab,var(--accent)_30%,var(--surface))]">
                <Mark />
                <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">NodeVault</span>
              </NodeHeader>
              <div className="flex flex-col gap-3 px-3.5 py-3.5 text-[13px]">
                <p className="m-0 leading-relaxed text-muted">Copy nodes out of Blender, share a link, paste them back in.</p>
                <nav aria-label="Footer" className="flex flex-col items-start gap-1">
                  <Link className="text-fg no-underline underline-offset-4 hover:underline" href="/">
                    Gallery
                  </Link>
                  <Link className="text-fg no-underline underline-offset-4 hover:underline" href="/paste">
                    Paste a graph
                  </Link>
                </nav>
                <div className="relative -mx-3.5 mt-1 border-t border-line px-3.5 pt-3 text-right text-subtle">
                  Made by
                  <Socket side="out" color="bg-accent" pinged={visible} socketRef={outSocket} />
                </div>
              </div>
            </>,
          )}

          {draggable(
            "creator",
            "max-w-[320px] self-end md:mt-24",
            <div onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}>
              <NodeHeader tint="bg-[color-mix(in_oklab,var(--tree-geometry)_40%,var(--surface))]">
                <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">Creator</span>
              </NodeHeader>
              <div className="flex flex-col gap-4 px-3.5 py-3.5">
                <div className="relative -mx-3.5 px-3.5 text-[13px] text-subtle">
                  <Socket side="in" color="bg-tree-geometry" pinged={visible} socketRef={inSocket} />
                  Made by
                </div>
                <div>
                  <p className="m-0 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] text-fg">{creator.name}</p>
                  <p className="mt-1.5 font-mono text-[13px] text-muted">@{creator.handle}</p>
                </div>
                <a
                  href={creator.xUrl}
                  target="_blank"
                  rel="noopener noreferrer me"
                  onFocus={() => setHot(true)}
                  onBlur={() => setHot(false)}
                  className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-fg px-3.5 py-2.5 text-[14px] font-medium text-bg no-underline transition-transform duration-150 ease-out-quart hover:-translate-y-px active:translate-y-0"
                >
                  <XGlyph className="size-4" />
                  Follow on X
                  <span aria-hidden="true" className="transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    ↗
                  </span>
                </a>
              </div>
            </div>,
            "[animation-delay:120ms]",
          )}
        </div>

        <div className="mt-8 flex flex-col gap-2 text-[12px] text-subtle sm:flex-row sm:justify-between">
          <p className="m-0 tabular-nums">© {year} NodeVault</p>
          <p className="m-0">Blender is a trademark of the Blender Foundation. NodeVault is an independent project.</p>
        </div>
      </div>
    </footer>
  )
}
