import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { headerColor, lookupNode, socketColor } from "@nodevault/catalog"
import type { InterfaceItem, NodeSocket, NodeVaultNode } from "@nodevault/interchange"
import { cssColor, cssThemeColor } from "./color"
import { handleId, nodeTitle, visibleSockets } from "./layout"
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
}: {
  socket: NodeSocket
  side: "in" | "out"
  linked: boolean
  catalog: NvNodeData["catalog"]
  nodeIdname: string
}) {
  const color = cssThemeColor(socketColor(catalog, socket.bl_idname))
  const title = `${socket.name} · ${socket.bl_idname} · ${socket.identifier}`
  const kind = valueKind(socket)
  const showValue = side === "in" && !linked && !socket.hide_value
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
        style={{ background: color }}
        isConnectable={false}
      />
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
          style={{ background: color }}
          isConnectable={false}
        />
        <Handle
          type="source"
          position={Position.Right}
          id={handleId("out", node.sockets.outputs[0]?.identifier ?? "Output")}
          className="nv-handle nv-handle-reroute"
          style={{ background: color }}
          isConnectable={false}
        />
        <span className="nv-reroute-dot" style={{ background: color }} />
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

  const props = (rec?.properties ?? []).filter(showProperty)
  const fill = headerFill(node, catalog, kind)
  const hasOuts = outputs.length > 0
  const outsAsBody = inputs.length === 0
  const hasRamp = Boolean(node.widgets.color_ramp)

  return (
    <article
      className={`nv-card${node.mute ? " nv-muted" : ""}${hasOuts && !outsAsBody ? " nv-has-outs" : ""}${hasRamp ? " nv-has-ramp" : ""}`}
      title={title}
      style={{
        width: Math.max(node.widgets.color_ramp ? 240 : 140, node.width),
        opacity: node.mute ? 0.45 : 1,
      }}
      data-id={node.id}
      data-bl-idname={node.bl_idname}
    >
      <header className="nv-header" style={{ background: fill }}>
        <span className="nv-caret" aria-hidden>
          ▾
        </span>
        <span className="nv-title">{nodeTitle(node, catalog)}</span>
        {node.mute ? <span className="nv-mute-line" /> : null}
      </header>
      <div className="nv-body">
        {props.map((prop) => (
          <PropertyRow key={prop.identifier} prop={prop} value={node.properties[prop.identifier]} />
        ))}
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
            />
          ))}
          {outsAsBody
            ? outputs.map((s) => (
                <SocketRow
                  key={s.identifier}
                  socket={s}
                  side="out"
                  linked={false}
                  catalog={catalog}
                  nodeIdname={node.bl_idname}
                />
              ))
            : null}
        </div>
        {hasOuts && !outsAsBody ? (
          <div className="nv-outs">
            {outputs.map((s) => (
              <SocketRow
                key={s.identifier}
                socket={s}
                side="out"
                linked={false}
                catalog={catalog}
                nodeIdname={node.bl_idname}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export { zoneCaption }
