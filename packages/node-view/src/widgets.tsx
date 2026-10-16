import type { CSSProperties, ReactNode } from "react"
import type { CatalogProperty } from "@nodevault/catalog"
import type {
  ColorRampWidget,
  CurveMappingWidget,
  ImageWidget,
  JsonValue,
} from "@nodevault/interchange"
import { cssColor } from "./color"

const SKIP_PROPS = new Set(["warning_propagation", "is_active_output"])

const PROP_LABEL: Record<string, string | null> = {
  vector_type: "Type",
  noise_dimensions: null,
  noise_type: null,
  normalize: "Normalize",
  invert: "Invert",
  from_instancer: "From Instancer",
  distribution: null,
  subsurface_method: null,
  target: null,
}

const AXIS = ["X", "Y", "Z", "W"] as const

/** Blender number buttons in the node editor always show three decimal places. */
export function formatNumber(value: number): string {
  return value.toFixed(3)
}

export function isRgba(value: JsonValue | undefined): value is number[] {
  return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number")
}

export function isVec(value: JsonValue | undefined): value is number[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 4 && value.every((n) => typeof n === "number") && value.length !== 4
}

export function ColorSwatch({ color, wide }: { color: readonly number[]; wide?: boolean }) {
  return <span className={wide ? "nv-swatch nv-swatch-wide" : "nv-swatch"} style={{ background: cssColor(color) }} />
}

export function ScalarBar({
  value,
  min,
  max,
}: {
  value: number
  min: number
  max: number
}) {
  const span = max - min
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / span))
  return (
    <div className="nv-bar">
      <div className="nv-bar-fill" style={{ width: `${t * 100}%` }} />
      <span className="nv-bar-label">{formatNumber(value)}</span>
    </div>
  )
}

export function NumberField({ value }: { value: number }) {
  return (
    <div className="nv-bar">
      <span className="nv-bar-label">{formatNumber(value)}</span>
    </div>
  )
}

export function VectorStack({ values }: { values: number[] }) {
  return (
    <div className="nv-vec">
      {values.map((n, i) => (
        <div key={AXIS[i] ?? i} className={`nv-vec-axis nv-vec-${AXIS[i]?.toLowerCase() ?? i}`}>
          <span className="nv-vec-letter">{AXIS[i]}</span>
          <NumberField value={n} />
        </div>
      ))}
    </div>
  )
}

export function Dropdown({ children }: { children: ReactNode }) {
  return <div className="nv-dropdown">{children}</div>
}

export function Checkbox({ on, label }: { on: boolean; label: string }) {
  return (
    <div className={`nv-check${on ? " nv-check-on" : ""}`}>
      <span className="nv-check-box" />
      <span>{label}</span>
    </div>
  )
}

export function ValueView({
  value,
  hideValue,
  kind,
}: {
  value: JsonValue | undefined
  hideValue: boolean
  kind: "factor" | "float" | "color" | "vector" | "generic"
}) {
  if (hideValue || value === undefined || value === null) return null
  if (kind === "vector" && Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return <VectorStack values={value} />
  }
  if (kind === "color" && Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return <ColorSwatch color={value} wide />
  }
  if (typeof value === "number") {
    if (kind === "factor") return <ScalarBar value={value} min={0} max={1} />
    return <NumberField value={value} />
  }
  if (typeof value === "boolean") return <Checkbox on={value} label="" />
  if (typeof value === "string") return <span className="nv-text-val">{value}</span>
  if (isRgba(value)) return <ColorSwatch color={value} wide />
  if (isVec(value)) return <VectorStack values={value} />
  return null
}

/** Properties Blender's draw code only shows in some modes, keyed by node type. */
const CONDITIONAL_PROPS: Record<string, Record<string, (props: Record<string, JsonValue>) => boolean>> = {
  ShaderNodeMix: {
    factor_mode: (p) => p.data_type === "VECTOR",
    blend_type: (p) => p.data_type === "RGBA",
    clamp_result: (p) => p.data_type === "RGBA",
  },
  ShaderNodeMapRange: {
    clamp: (p) => p.interpolation_type !== "SMOOTHSTEP" && p.interpolation_type !== "SMOOTHERSTEP",
  },
}

export function showProperty(
  prop: CatalogProperty,
  blIdname?: string,
  values: Record<string, JsonValue> = {},
): boolean {
  if (SKIP_PROPS.has(prop.identifier)) return false
  if (prop.type !== "ENUM" && prop.type !== "BOOLEAN") return false
  const rule = blIdname ? CONDITIONAL_PROPS[blIdname]?.[prop.identifier] : undefined
  return rule ? rule(values) : true
}

export function PropertyRow({
  prop,
  value,
}: {
  prop: CatalogProperty
  value: JsonValue | undefined
}) {
  const shown = value !== undefined ? value : prop.default
  if (prop.type === "ENUM") {
    const id = typeof shown === "string" ? shown : String(shown ?? "")
    const name = prop.enum_items?.find((e) => e.identifier === id)?.name ?? id
    const label = Object.hasOwn(PROP_LABEL, prop.identifier)
      ? PROP_LABEL[prop.identifier]
      : prop.identifier.replaceAll("_", " ")
    return (
      <div className="nv-prop nv-prop-enum">
        {label ? <span className="nv-prop-name">{label}</span> : null}
        <Dropdown>{name}</Dropdown>
      </div>
    )
  }
  if (prop.type === "BOOLEAN") {
    const label =
      PROP_LABEL[prop.identifier] ??
      prop.identifier.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())
    return (
      <div className="nv-prop">
        <Checkbox on={Boolean(shown)} label={label} />
      </div>
    )
  }
  return null
}

function prettyEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-")
}

export function ColorRampBar({ widget }: { widget: ColorRampWidget }) {
  const stops = [...widget.elements].sort((a, b) => a.position - b.position)
  const gradient =
    stops.length === 0
      ? "transparent"
      : stops.length === 1
        ? cssColor(stops[0]!.color)
        : `linear-gradient(to right, ${stops
            .map((s) => `${cssColor(s.color)} ${s.position * 100}%`)
            .join(", ")})`
  const active = stops[0]
  return (
    <div className="nv-ramp">
      <div className="nv-ramp-toolbar">
        <span className="nv-ramp-btn" aria-hidden>
          +
        </span>
        <span className="nv-ramp-btn" aria-hidden>
          −
        </span>
        <span className="nv-ramp-btn nv-ramp-menu" aria-hidden />
        <Dropdown>{widget.color_mode}</Dropdown>
        <Dropdown>{prettyEnum(widget.interpolation)}</Dropdown>
      </div>
      <div className="nv-ramp-bar" style={{ background: gradient }}>
        {stops.map((s, i) => (
          <span
            key={`${s.position}-${i}`}
            className={`nv-ramp-stop${i === 0 ? " nv-ramp-stop-active" : ""}`}
            style={{ left: `${s.position * 100}%`, "--nv-stop": cssColor(s.color) } as CSSProperties}
          />
        ))}
      </div>
      {active ? (
        <>
          <div className="nv-ramp-pos">
            <span className="nv-ramp-index">1</span>
            <div className="nv-bar">
              <span className="nv-ramp-pos-name">Pos</span>
              <span className="nv-bar-label">{active.position.toFixed(3)}</span>
            </div>
          </div>
          <ColorSwatch color={active.color} wide />
        </>
      ) : null}
    </div>
  )
}

export function CurveSparklines({ widget }: { widget: CurveMappingWidget }) {
  return (
    <div className="nv-curves">
      {widget.curves.map((curve, i) => {
        const pts = curve.points.map((p) => p.location)
        const xs = pts.map((p) => p[0])
        const ys = pts.map((p) => p[1])
        const minX = widget.use_clip ? widget.clip_min_x : Math.min(...xs)
        const maxX = widget.use_clip ? widget.clip_max_x : Math.max(...xs)
        const minY = widget.use_clip ? widget.clip_min_y : Math.min(...ys)
        const maxY = widget.use_clip ? widget.clip_max_y : Math.max(...ys)
        const w = 140
        const h = 48
        const sx = (x: number) => ((x - minX) / (maxX - minX || 1)) * w
        const sy = (y: number) => h - ((y - minY) / (maxY - minY || 1)) * h
        const d = pts.map((p, j) => `${j === 0 ? "M" : "L"} ${sx(p[0])} ${sy(p[1])}`).join(" ")
        return (
          <svg key={i} className="nv-curve" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <path d={d} fill="none" stroke="#c7c7c7" strokeWidth="1.5" />
          </svg>
        )
      })}
    </div>
  )
}

export function ImageCaption({ widget }: { widget: ImageWidget }) {
  return <div className="nv-caption">{widget.name || widget.filepath || "(image)"}</div>
}
