import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react"

/** Blender noodle: dark casing with a socket-colored core. */
export function NvEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.45,
  })
  const color = typeof style?.stroke === "string" ? style.stroke : "#a3a3a3"
  const faded = style?.opacity === 0.5
  const dash = style?.strokeDasharray
  const opacity = faded ? 0.5 : 1
  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="#141414"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={dash}
        opacity={opacity}
      />
      <BaseEdge
        path={path}
        interactionWidth={12}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeLinecap: "round",
          ...(dash !== undefined ? { strokeDasharray: dash } : {}),
          opacity,
        }}
        {...(markerEnd !== undefined ? { markerEnd } : {})}
      />
    </>
  )
}
