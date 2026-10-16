import type { CSSProperties } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { headerColor, lookupNode, socketColor } from "@nodevault/catalog"
import type { InterfaceItem, JsonValue, NodeSocket, NodeVaultNode } from "@nodevault/interchange"
import { cssColor, cssThemeColor } from "./color"
import { handleId, nodeTitle, nodeWidth, visibleSockets } from "./layout"
import type { NvNodeData } from "./types"
import {
  ColorRampBar,
  CurveSparklines,
  ImageCaption,
  PropertyRow,
  ValueView,
  showProperty,
} from "./widgets"

function zoneCaption(bl_idname: string): string {
  if (bl_idname.includes("Simulation")) return "Simulation"
  if (bl_idname.includes("Repeat")) return "Repeat"
  if (bl_idname.includes("Foreach") || bl_idname.includes("ForEach")) return "For Each"
  if (bl_idname.includes("Closure")) return "Closure"
  return "Zone"
}

function headerFill(node: NodeVaultNode, catalog: NvNodeData["catalog"], kind: string): string {
  if (node.use_custom_color && node.color && node.color.length >= 3) {
    return cssColor(node.color)
  }
  if (kind === "group") {
    const groupTheme = catalog?.themes["group_node"]
    if (groupTheme) return cssThemeColor(groupTheme)
  }
  return cssThemeColor(headerColor(catalog, node.bl_idname))
}

function socketCaption(
  socket: NodeSocket,
  catalog: NvNodeData["catalog"],
  nodeIdname: string,
  side: "in" | "out",
): string {
  if (socket.label) return socket.label
  const rec = lookupNode(catalog, nodeIdname)
  const listed = (side === "in" ? rec?.inputs : rec?.outputs)?.find((s) => s.identifier === socket.identifier)
  return listed?.name || socket.name || socket.identifier
}

function valueKind(socket: NodeSocket): "factor" | "float" | "color" | "vector" | "generic" {
  if (socket.bl_idname.includes("Vector") || socket.type === "VECTOR") return "vector"
  if (socket.bl_idname.includes("Color") || socket.type === "RGBA") return "color"
  if (socket.bl_idname.includes("Factor")) return "factor"
  if (typeof socket.default_value === "number") return "float"
  return "generic"
}

function SocketRow({
  socket,
  side,
  linked,
  catalog,
  nodeIdname,
  hideValue = false,
}: {
  socket: NodeSocket
  side: "in" | "out"
  linked: boolean
  catalog: NvNodeData["catalog"]
  nodeIdname: string
  hideValue?: boolean
}) {
  const color = cssThemeColor(socketColor(catalog, socket.bl_idname))
  const title = `${socket.name} · ${socket.bl_idname} · ${socket.identifier}`
  const kind = valueKind(socket)
  const showValue = side === "in" && !linked && !socket.hide_value && !hideValue
  const vector = showValue && kind === "vector"
  const name = socketCaption(socket, catalog, nodeIdname, side)
  return (
    <div
      className={`nv-sock nv-sock-${side}${vector ? " nv-sock-vector" : ""}${showValue ? " nv-sock-valued" : ""}`}
      title={title}
    >
      <Handle
        type={side === "in" ? "target" : "source"}
        position={side === "in" ? Position.Left : Position.Right}
        id={handleId(side, socket.identifier)}
        className="nv-handle"
        style={{ "--nv-sock": color } as CSSProperties}
        isConnectable={false}
      >
        <span className="nv-diamond" />
      </Handle>
      {vector ? <span className="nv-vec-title">{name}</span> : <span className="nv-sock-name">{name}</span>}
      {showValue ? <ValueView value={socket.default_value} hideValue={false} kind={kind} /> : null}
    </div>
  )
}

function interfaceSockets(items: InterfaceItem[], inOut: "INPUT" | "OUTPUT"): InterfaceItem[] {
  return items.filter((i) => i.item_type !== "PANEL" && i.in_out === inOut)
}

export function NvNode({ data }: NodeProps<Node<NvNodeData>>) {
  const { payloadNode: node, catalog, linkedInputs, blenderVersion, kind, groupTree } = data
  const rec = lookupNode(catalog, node.bl_idname)
  const title = `${node.bl_idname} · Blender ${blenderVersion}`

  if (kind === "zone-bg") {
    return (
      <div className="nv-zone" title={data.zoneLabel}>
        <span className="nv-zone-label">{data.zoneLabel}</span>
      </div>
    )
  }

  if (kind === "reroute") {
    const sock = node.sockets.outputs[0] ?? node.sockets.inputs[0]
    const color = cssThemeColor(socketColor(catalog, sock?.bl_idname ?? ""))
    return (
      <div className="nv-reroute" title={title} style={{ opacity: node.mute ? 0.45 : 1 }}>
        <Handle
          type="target"
          position={Position.Left}
          id={handleId("in", node.sockets.inputs[0]?.identifier ?? "Input")}
          className="nv-handle nv-handle-reroute"
          isConnectable={false}
        />
        <Handle
          type="source"
          position={Position.Right}
          id={handleId("out", node.sockets.outputs[0]?.identifier ?? "Output")}
          className="nv-handle nv-handle-reroute"
          isConnectable={false}
        />
        <span className="nv-diamond" style={{ "--nv-sock": color } as CSSProperties} />
      </div>
    )
  }

  if (kind === "frame") {
    const label = node.label || node.text || ""
    return (
      <div
        className="nv-frame"
        title={title}
        style={{ width: node.width, height: node.height ?? 80, opacity: node.mute ? 0.45 : 1 }}
      >
        <div className="nv-frame-label" style={{ fontSize: node.label_size ?? 14 }}>
          {label}
        </div>
      </div>
    )
  }

  const vis = visibleSockets(node)
  let inputs = vis.inputs
  let outputs = vis.outputs
  if (kind === "group" && inputs.length === 0 && outputs.length === 0) {
    const items = groupTree?.interface ?? []
    inputs = interfaceSockets(items, "INPUT").map((item, index) => ({
      identifier: item.identifier,
      name: item.name,
      label: "",
      bl_idname: item.socket_type ?? "NodeSocketFloat",
      type: "",
      index,
      hide: false,
      hide_value: item.hide_value ?? false,
      enabled: true,
      ...(item.default_value !== undefined ? { default_value: item.default_value } : {}),
    }))
    outputs = interfaceSockets(items, "OUTPUT").map((item, index) => ({
      identifier: item.identifier,
      name: item.name,
      label: "",
      bl_idname: item.socket_type ?? "NodeSocketFloat",
      type: "",
      index,
      hide: false,
      hide_value: true,
      enabled: true,
    }))
  }

  const propValues: Record<string, JsonValue> = Object.fromEntries(
    (rec?.properties ?? []).map((p) => [p.identifier, node.properties[p.identifier] ?? (p.default as JsonValue)]),
  )
  const props = (rec?.properties ?? []).filter((p) => showProperty(p, node.bl_idname, propValues))
  const fill = headerFill(node, catalog, kind)
  const outsOnly = inputs.length === 0
  const hasRamp = Boolean(node.widgets.color_ramp)
  const propertyRows = props.map((prop) => (
    <PropertyRow key={prop.identifier} prop={prop} value={node.properties[prop.identifier]} />
  ))
  const pointerRows = (POINTER_FIELDS[node.bl_idname] ?? []).map((name) => (
    <div key={name} className="nv-prop">
      <div className="nv-dropdown nv-pointer">{name}</div>
    </div>
  ))
  const outputRows = outputs.map((s) => (
    <SocketRow
      key={s.identifier}
      socket={s}
      side="out"
      linked={false}
      catalog={catalog}
      nodeIdname={node.bl_idname}
    />
  ))

  return (
    <article
      className={`nv-card${node.mute ? " nv-muted" : ""}${hasRamp ? " nv-has-ramp" : ""}`}
      title={title}
      style={{
        width: nodeWidth(node),
        opacity: node.mute ? 0.45 : 1,
      }}
      data-id={node.id}
      data-bl-idname={node.bl_idname}
    >
      <header className="nv-header" style={{ background: fill }}>
        <span className="nv-caret" aria-hidden />
        <span className="nv-title">{nodeTitle(node, catalog)}</span>
        {node.mute ? <span className="nv-mute-line" /> : null}
      </header>
      <div className="nv-body">
        {!outsOnly && outputRows.length > 0 ? <div className="nv-out-stack">{outputRows}</div> : null}
        {!outsOnly && propertyRows.length > 0 ? <div className="nv-props">{propertyRows}</div> : null}
        {kind === "group" ? <div className="nv-caption">{groupTree?.name ?? node.name}</div> : null}
        {node.widgets.color_ramp ? <ColorRampBar widget={node.widgets.color_ramp} /> : null}
        {node.widgets.mapping ? <CurveSparklines widget={node.widgets.mapping} /> : null}
        {node.widgets.image ? <ImageCaption widget={node.widgets.image} /> : null}
        <div className="nv-ins">
          {inputs.map((s) => (
            <SocketRow
              key={s.identifier}
              socket={s}
              side="in"
              linked={linkedInputs.has(s.identifier)}
              catalog={catalog}
              nodeIdname={node.bl_idname}
              hideValue={hasRamp}
            />
          ))}
          {outsOnly ? outputRows : null}
        </div>
        {outsOnly && (propertyRows.length > 0 || pointerRows.length > 0) ? (
          <div className="nv-props">
            {pointerRows}
            {propertyRows}
          </div>
        ) : null}
      </div>
    </article>
  )
}

/** Object/ID pickers Blender draws on a node. The catalog has no pointer properties, so these are listed by hand. */
const POINTER_FIELDS: Record<string, string[]> = {
  ShaderNodeTexCoord: ["Object"],
}

export { zoneCaption }
