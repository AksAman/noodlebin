"use client"

import { friendlyCompileLog, wrapShadertoy } from "@/lib/shaderCover"
import { cn } from "@/lib/ui"
import { useEffect, useRef, useState } from "react"

/*
 * Browsers cap live WebGL contexts at roughly sixteen per page, so every cover on the page
 * shares one offscreen context: it renders each visible cover in turn and copies the frame
 * into that cover's own 2D canvas.
 */

type Compiled = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> } | { error: string }

type Cover = {
  source: string
  target: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  visible: boolean
  start: number
  last: number
  frame: number
  onState: (state: "live" | "error", error?: string) => void
}

const MAX_DPR = 1.5
const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

class SharedRenderer {
  private canvas: HTMLCanvasElement | null = null
  private gl: WebGL2RenderingContext | null = null
  private programs = new Map<string, Compiled>()
  private covers = new Set<Cover>()
  private raf = 0
  private still = typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-motion: reduce)")

  private context(): WebGL2RenderingContext | null {
    if (this.gl && !this.gl.isContextLost()) return this.gl
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true })
    if (!gl) return null
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault()
      cancelAnimationFrame(this.raf)
      this.programs.clear()
      this.gl = null
      /* Usually a shader that stalled the GPU; retrying would stall it again, so the posters take over. */
      for (const cover of this.covers) cover.onState("error", "The shader stalled the GPU, so it was stopped.")
      this.covers.clear()
    })
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.canvas = canvas
    this.gl = gl
    this.programs.clear()
    return gl
  }

  private compile(source: string): Compiled {
    const cached = this.programs.get(source)
    if (cached) return cached
    const gl = this.context()
    if (!gl) return { error: "WebGL 2 is not available in this browser." }
    const shader = (type: number, text: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, text)
      gl.compileShader(s)
      return s
    }
    const vs = shader(gl.VERTEX_SHADER, VERTEX)
    const fs = shader(gl.FRAGMENT_SHADER, wrapShadertoy(source))
    let result: Compiled
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      result = { error: friendlyCompileLog(gl.getShaderInfoLog(fs) ?? "Shader did not compile.") }
    } else {
      const program = gl.createProgram()!
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.bindAttribLocation(program, 0, "aPos")
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        result = { error: friendlyCompileLog(gl.getProgramInfoLog(program) ?? "Shader did not link.") }
        gl.deleteProgram(program)
      } else {
        const names = ["iResolution", "iTime", "iTimeDelta", "iFrame", "iMouse"]
        result = { program, uniforms: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)])) }
      }
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    this.programs.set(source, result)
    return result
  }

  add(cover: Cover): void {
    this.covers.add(cover)
    const compiled = this.compile(cover.source)
    if ("error" in compiled) {
      cover.onState("error", compiled.error)
      return
    }
    this.render(cover, 0)
    this.schedule()
  }

  remove(cover: Cover): void {
    this.covers.delete(cover)
    if (this.covers.size === 0) cancelAnimationFrame(this.raf)
  }

  wake(): void {
    this.schedule()
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf)
    if (this.still?.matches) return
    this.raf = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    let any = false
    for (const cover of this.covers) {
      if (!cover.visible) continue
      any = true
      this.render(cover, (now - cover.start) / 1000)
    }
    if (any && !this.still?.matches) this.raf = requestAnimationFrame(this.tick)
  }

  private render(cover: Cover, time: number): void {
    const compiled = this.compile(cover.source)
    const gl = this.context()
    if (!gl || "error" in compiled || !this.canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const w = Math.max(1, Math.round(cover.target.clientWidth * dpr))
    const h = Math.max(1, Math.round(cover.target.clientHeight * dpr))
    if (cover.target.width !== w || cover.target.height !== h) {
      cover.target.width = w
      cover.target.height = h
    }
    if (this.canvas.width < w || this.canvas.height < h) {
      this.canvas.width = Math.max(this.canvas.width, w)
      this.canvas.height = Math.max(this.canvas.height, h)
    }
    gl.viewport(0, 0, w, h)
    gl.useProgram(compiled.program)
    const u = compiled.uniforms
    gl.uniform3f(u["iResolution"]!, w, h, 1)
    gl.uniform1f(u["iTime"]!, time)
    gl.uniform1f(u["iTimeDelta"]!, cover.last ? time - cover.last : 0)
    gl.uniform1i(u["iFrame"]!, cover.frame++)
    gl.uniform4f(u["iMouse"]!, 0, 0, 0, 0)
    cover.last = time
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const glHeight = this.canvas.height
    cover.ctx.drawImage(this.canvas, 0, glHeight - h, w, h, 0, 0, w, h)
    if (cover.frame === 1) cover.onState("live")
  }
}

let shared: SharedRenderer | null = null
const renderer = () => (shared ??= new SharedRenderer())

/**
 * A live GLSL cover. The poster image stays underneath until the shader draws its first frame,
 * and remains the cover whenever the shader cannot run.
 */
export function ShaderCover({
  source,
  poster,
  className,
  canvasClassName,
  onError,
}: {
  source: string
  poster?: string | null | undefined
  className?: string | undefined
  canvasClassName?: string | undefined
  onError?: ((error: string | null) => void) | undefined
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [live, setLive] = useState(false)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const target = canvasRef.current
    const ctx = target?.getContext("2d")
    if (!target || !ctx) return
    setLive(false)
    onErrorRef.current?.(null)
    const cover: Cover = {
      source,
      target,
      ctx,
      visible: false,
      start: performance.now(),
      last: 0,
      frame: 0,
      onState: (state, error) => {
        setLive(state === "live")
        if (state === "error") onErrorRef.current?.(error ?? "Shader did not compile.")
      },
    }
    const visibility = new IntersectionObserver(([entry]) => {
      cover.visible = Boolean(entry?.isIntersecting)
      if (cover.visible) renderer().wake()
    })
    visibility.observe(target)
    renderer().add(cover)
    return () => {
      visibility.disconnect()
      renderer().remove(cover)
    }
  }, [source])

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      {poster ? <img className="block h-full w-full object-cover" src={poster} alt="" /> : null}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 block size-full transition-opacity duration-300",
          live ? "opacity-100" : "opacity-0",
          canvasClassName,
        )}
      />
    </div>
  )
}
