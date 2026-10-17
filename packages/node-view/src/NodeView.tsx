import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { Catalog } from "@nodevault/catalog";
import type { NodeVaultTree } from "@nodevault/interchange";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { cssThemeColor } from "./color";
import { treeToFlow } from "./graph";
import { NvEdge } from "./NvEdge";
import { NvNode } from "./NvNode";
import { ShowPreviewsContext } from "./preview-context";
import type { NvNodeData } from "./types";

const nodeTypes = { nv: NvNode };
const edgeTypes = { default: NvEdge };
const nodeClassName = (node: Node) => node.type ?? "";

type CanvasScheme = "light" | "dark";

type CanvasTheme = {
  scheme: CanvasScheme;
  bg: string;
  grid: string;
};

const DARK_CANVAS: CanvasTheme = {
  scheme: "dark",
  bg: "#171717",
  grid: "#4e4e4e",
};

function readScheme(el: HTMLElement): CanvasScheme {
  if (el.closest("[data-theme='dark']")) return "dark";
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function useCanvasTheme(ref: RefObject<HTMLElement | null>): CanvasTheme {
  const [theme, setTheme] = useState<CanvasTheme>(DARK_CANVAS);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const scheme = readScheme(el);
      el.dataset.nvScheme = scheme;
      const styles = getComputedStyle(el);
      setTheme({
        scheme,
        bg: styles.getPropertyValue("--nv-bg").trim() || DARK_CANVAS.bg,
        grid: styles.getPropertyValue("--nv-grid").trim() || DARK_CANVAS.grid,
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", apply);
    };
  }, [ref]);

  return theme;
}

export type NodeViewProps = {
  tree: NodeVaultTree;
  catalog: Catalog | null;
  readOnly: true;
  onCopy?: () => void;
  /** All payload trees; used to open groups. Defaults to `[tree]`. */
  trees?: NodeVaultTree[];
  blenderVersion?: string;
  showMinimap?: boolean;
};

function NodeViewInner({
  tree,
  catalog,
  onCopy,
  trees,
  blenderVersion = "",
  showMinimap = true,
}: NodeViewProps) {
  const allTrees = useMemo(() => trees ?? [tree], [trees, tree]);
  const [stack, setStack] = useState<NodeVaultTree[]>([tree]);
  const current = stack[stack.length - 1] ?? tree;
  const { fitView } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStack([tree]);
  }, [tree]);

  const built = useMemo(
    () => treeToFlow(current, catalog, blenderVersion, allTrees),
    [current, catalog, blenderVersion, allTrees],
  );
  const [nodes, setNodes] = useState(built.nodes);
  const [flow, setFlow] = useState(built);
  const [showPreviews, setShowPreviews] = useState(true);
  if (flow !== built) {
    setFlow(built);
    setNodes(built.nodes);
  }

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<NvNodeData>>[]) => {
      setNodes((currentNodes) =>
        applyNodeChanges(
          changes.filter((change) => change.type !== "remove"),
          currentNodes,
        ),
      );
    },
    [],
  );

  const moved = useMemo(() => {
    const home = new Map(built.nodes.map((n) => [n.id, n.position]));
    return nodes.some((n) => {
      const p = home.get(n.id);
      return p !== undefined && (p.x !== n.position.x || p.y !== n.position.y);
    });
  }, [nodes, built.nodes]);

  const resetLayout = useCallback(() => {
    setNodes(built.nodes);
    requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 300 }));
  }, [built.nodes, fitView]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void fitView({ padding: 0.2 });
    });
    return () => cancelAnimationFrame(id);
  }, [current, fitView]);

  const onNodeDoubleClick = useCallback(
    (_: unknown, node: { data: NvNodeData }) => {
      const gid = node.data.payloadNode.group_tree_id;
      if (!gid) return;
      const next = allTrees.find((t) => t.id === gid);
      if (next) setStack((s) => [...s, next]);
    },
    [allTrees],
  );

  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "f" || event.key === "F") {
        if (
          !(
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement
          )
        ) {
          event.preventDefault();
          void fitView({ padding: 0.2 });
        }
      }
      if (
        (event.key === "r" || event.key === "R") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
      ) {
        event.preventDefault();
        resetLayout();
      }
      if (event.key === "Escape") {
        pop();
      }
      const copyKey =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c";
      if (copyKey && onCopy) {
        const sel = window.getSelection()?.toString() ?? "";
        if (!sel) {
          event.preventDefault();
          onCopy();
        }
      }
    },
    [fitView, onCopy, pop, resetLayout],
  );

  const grid = catalog?.themes["grid"];
  const theme = useCanvasTheme(wrapRef);
  const gridColor =
    theme.scheme === "light"
      ? theme.grid
      : grid
        ? cssThemeColor(grid)
        : theme.grid;
  const bgColor = theme.scheme === "light" ? theme.bg : DARK_CANVAS.bg;

  return (
    <ShowPreviewsContext.Provider value={showPreviews}>
    <div
      className="nv-root"
      data-nv-scheme={theme.scheme}
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="nv-chrome">
        <button
          type="button"
          className="nv-preview-toggle"
          aria-pressed={showPreviews}
          onClick={() => setShowPreviews((on) => !on)}
        >
          <span className={`nv-check${showPreviews ? " nv-check-on" : ""}`}>
            <span className="nv-check-box" />
          </span>
          Show node previews
        </button>
        {stack.length > 1 ? (
          <nav className="nv-crumbs" aria-label="Group trees">
            {stack.map((t, i) => (
              <button
                key={`${t.id}-${i}`}
                type="button"
                className="nv-crumb"
                onClick={() => setStack((s) => s.slice(0, i + 1))}
              >
                {i === 0 ? "Root" : t.name || t.id}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {moved ? (
        <button type="button" className="nv-reset" onClick={resetLayout}>
          Reset layout <kbd className="nv-kbd">R</kbd>
        </button>
      ) : null}
      <ol className="nv-a11y">
        {current.nodes.map((n) => (
          <li key={n.id}>
            {n.name} ({n.bl_idname})
          </li>
        ))}
      </ol>
      <ReactFlow
        nodes={nodes}
        edges={built.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        edgesReconnectable={false}
        elevateNodesOnSelect={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        selectionOnDrag={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.15}
        maxZoom={2}
        colorMode={theme.scheme}
        attributionPosition="bottom-left"
        defaultEdgeOptions={{ type: "default" }}
        onNodeDoubleClick={onNodeDoubleClick}
        onInit={() => void fitView({ padding: 0.2 })}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={40}
          size={1.5}
          color={gridColor}
          bgColor={bgColor}
        />
        {showMinimap ? (
          <MiniMap
            pannable
            zoomable
            style={{ width: 108, height: 72 }}
            nodeStrokeWidth={3}
            nodeClassName={nodeClassName}
          />
        ) : null}
      </ReactFlow>
    </div>
    </ShowPreviewsContext.Provider>
  );
}

export function NodeView(props: NodeViewProps) {
  if (props.readOnly !== true) {
    throw new Error("NodeView is read-only");
  }
  return (
    <ReactFlowProvider>
      <NodeViewInner {...props} />
    </ReactFlowProvider>
  );
}
