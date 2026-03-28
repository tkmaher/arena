"use client";
import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Panel,
  type Node,
  Edge
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import BlockProp from "@/components/node";
import { getBlock, getChannel } from "@/scripts/getBlock";
import { Block, Channel } from "@/types/arena";

const GRID_SIZE = 250;
const MENU_W = 200; // approximate pill width, used for clamping
const MENU_H = 44;  // approximate pill height

interface NodeData { onCanvas: boolean; children: string[] }
const nodeMap = new Map<string, NodeData>();
const availablePositions: { x: number; y: number }[] = [{ x: 0, y: 0 }];
const occupiedPositions = new Set<{ x: number; y: number }>();

const nodeTypes = { Canvas: BlockProp };

function deriveEdges(): Edge[] {
    const edges: Edge[] = [];
    for (const [parentId, data] of nodeMap.entries()) {
      if (!data.onCanvas) continue;
      for (const childId of data.children) {
        if (nodeMap.get(childId)?.onCanvas) {
          edges.push({ id: `${parentId}-${childId}`, source: parentId.toString(), target: childId.toString() });
        }
      }
    }
    console.log("Derived edges:", edges);
    return edges;
  }
  

// ─── Radial context menu pill ─────────────────────────────────────────────────
interface RadialMenuProps {
  origin: { x: number; y: number } | null;
  onClose: () => void;
  onAddBlock: (id: string) => void;
  onAddChannel: (id: string) => void;
}

function RadialMenu({ origin, onClose, onAddBlock, onAddChannel }: RadialMenuProps) {
  const [blockInput, setBlockInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!origin) return null;

  // Clamp so pills don't overflow viewport
  const OFFSET = 130; // horizontal distance from origin to pill center
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const clamp = (val: number, lo: number, hi: number) => Math.min(Math.max(val, lo), hi);

  const leftCenter = {
    x: clamp(origin.x - OFFSET, MENU_W / 2 + 8, vw - MENU_W / 2 - 8),
    y: clamp(origin.y, MENU_H / 2 + 8, vh - MENU_H / 2 - 8),
  };
  const rightCenter = {
    x: clamp(origin.x + OFFSET, MENU_W / 2 + 8, vw - MENU_W / 2 - 8),
    y: clamp(origin.y, MENU_H / 2 + 8, vh - MENU_H / 2 - 8),
  };

  const submitBlock = () => {
    if (!blockInput.trim()) return;
    onAddBlock(blockInput.trim());
    setBlockInput("");
    setBlockOpen(false);
    onClose();
  };

  const submitChannel = () => {
    if (!channelInput.trim()) return;
    onAddChannel(channelInput.trim());
    setChannelInput("");
    setChannelOpen(false);
    onClose();
  };

  return (
    // Invisible overlay catches outside-clicks to dismiss
    <div
        style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "auto" }}
        onMouseDown={(e) => {
            // Only close if clicking the backdrop itself, not the pills
            if (e.target === e.currentTarget) onClose();
        }}
    >

        <div
            style={{
                position: "absolute",
                left: leftCenter.x,
                top: leftCenter.y,
                transform: "translate(-50%,-50%)",
                animation: "radial-left 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="react-flow__controls"
        >
            <div
                style={{
                    padding: blockOpen ? "6px 10px 6px 14px" : "6px 16px",
                    cursor: blockOpen ? "default" : "pointer",
                }}
                className=" popup-menu"
                onClick={() => setBlockOpen(true)}
            >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", letterSpacing: 0.2 }}>
                    Block
                </span>
                {blockOpen ? (
                    <>
                        <input
                            autoFocus
                            type="text"
                            placeholder="ID…"
                            value={blockInput}
                            onChange={(e) => setBlockInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submitBlock()}
                            className="popup-menu-input"
                        />
                        <button
                            onClick={submitBlock}
                            style={{
                            background: "#111",
                            color: "#fff",
                            border: "none",
                            borderRadius: 999,
                            padding: "3px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                            }}
                        >
                            Add
                        </button>
                    </>
                ) : (
                    <button
                        
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 18,
                            lineHeight: 1,
                            color: "#6b7280",
                            padding: 0,
                        }}
                        >
                            +
                    </button>
                )}
            </div>
        </div>

        <div
            style={{
                position: "absolute",
                left: rightCenter.x,
                top: rightCenter.y,
                transform: "translate(-50%,-50%)",
                animation: "radial-right 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="react-flow__controls"
        >
            <div
                style={{
                    padding: channelOpen ? "6px 10px 6px 14px" : "6px 16px",
                    cursor: channelOpen ? "default" : "pointer",
                }}
                className="popup-menu"
                onClick={() => setChannelOpen(true)}
            >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", letterSpacing: 0.2 }}>
                    Channel
                </span>
                {channelOpen ? (
                    <>
                        <input
                            autoFocus
                            type="text"
                            placeholder="ID…"
                            value={channelInput}
                            onChange={(e) => setChannelInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submitChannel()}
                            className="popup-menu-input"
                        />
                        <button
                            onClick={submitChannel}
                            style={{
                            background: "#111",
                            color: "#fff",
                            border: "none",
                            borderRadius: 999,
                            padding: "3px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                            }}
                        >
                            Add
                        </button>
                    </>
                ) : (
                    <button
                    
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: 1,
                        color: "#6b7280",
                        padding: 0,
                    }}
                    >
                        +
                    </button>
                )}
            </div>
        </div>

        <style>{`
            @keyframes radial-left {
            from { opacity: 0; transform: translate(calc(-50% + 80px), -50%) scale(0.7); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes radial-right {
            from { opacity: 0; transform: translate(calc(-50% - 80px), -50%) scale(0.7); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes radial-dot {
            from { opacity: 0; transform: translate(-50%,-50%) scale(0); }
            to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
            }
        `}
        </style>
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function CanvasInner() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [menuOrigin, setMenuOrigin] = useState<{ x: number; y: number } | null>(null);
  
    // Call after any nodeMap mutation + setNodes to keep edges in sync
    function syncEdges() {
      setEdges(deriveEdges());
    }
  
    function getNextPosition() {
        const position = availablePositions.length ? availablePositions.shift()! : { x: 0, y: 0 };
        occupiedPositions.add(position);
        for (let i = position.x - 1; i <= position.x + 1; i++)
            for (let j = position.y - 1; j <= position.y + 1; j++)
                if (!occupiedPositions.has({ x: i, y: j }) && !(position.x === i && position.y === j))
                    availablePositions.push({ x: i, y: j });
        return position;
    }
  
    function addConnection(connection: Block | Channel, child: string, onCanvas: boolean) {
        if (!nodeMap.has(connection.id)) nodeMap.set(connection.id, { onCanvas, children: [child] });
        else {
            nodeMap.get(connection.id)!.onCanvas = onCanvas;
            nodeMap.get(connection.id)!.children.push(child);
        }
    }
  
    function addChild(connection: Block | Channel, parent: string, onCanvas: boolean) {
        if (!nodeMap.has(connection.id)) nodeMap.set(connection.id, { onCanvas, children: [] });
        if (!nodeMap.has(parent)) nodeMap.set(parent, { onCanvas, children: [connection.id] });
        else nodeMap.get(parent)!.children.push(connection.id);
    }
  
    async function addBlockNode(id: string, data?: Block) {
        if (nodeMap.has(id) && nodeMap.get(id)?.onCanvas) return;
        const block = data ?? await getBlock(id);
        if (!block) return;
        const newNodes: Node[] = [];
    
        function collectNode(nodeId: string, obj: Block | Channel) {
            if (nodeMap.has(nodeId) && nodeMap.get(nodeId)?.onCanvas) return;
            const pos = getNextPosition();
            nodeMap.set(nodeId, { onCanvas: true, children: nodeMap.get(nodeId)?.children ?? [] });
            newNodes.push({
                id: nodeId.toString(), type: "Canvas",
                position: { x: pos.x * GRID_SIZE, y: pos.y * GRID_SIZE },
                style: { width: GRID_SIZE * 0.75, height: GRID_SIZE * 0.75 },
                data: { object: obj },
            });
        }
  
        collectNode(id, block);
        if (!data) {
            let i = 0;
            for (const c of block.connectionStatus.connections) {
                if (i++ <= 8) { collectNode(c.id, c); addConnection(c, id, true); }
                else addConnection(c, id, false);
            }
        }
  
        // nodeMap fully updated before deriving edges
        setNodes(nds => [...nds, ...newNodes]);
        syncEdges();
    }
  
    async function addChannelNode(id: string, data?: Channel) {
        if (nodeMap.has(id) && nodeMap.get(id)?.onCanvas) return;
        const channel = data ?? await getChannel(id);
        if (!channel) return;
        id = channel.id;
        const newNodes: Node[] = [];
    
        function collectNode(nodeId: string, obj: Block | Channel) {
            if (nodeMap.has(nodeId) && nodeMap.get(nodeId)?.onCanvas) return;
            const pos = getNextPosition();
            nodeMap.set(nodeId, { onCanvas: true, children: nodeMap.get(nodeId)?.children ?? [] });
            newNodes.push({
                id: nodeId.toString(), type: "Canvas",
                position: { x: pos.x * GRID_SIZE, y: pos.y * GRID_SIZE },
                style: { width: GRID_SIZE * 0.75, height: GRID_SIZE * 0.75 },
                data: { object: obj },
            });
        }
  
      collectNode(id, channel);
      if (!data) {
        for (const c of channel.connectionStatus.connections) addConnection(c, id, false);
        let i = 0;
        for (const child of channel.childrenStatus.children) {
          if (i++ < 8) { collectNode(child.id, child); addChild(child, id, true); }
          else addChild(child, id, false);
        }
      }
  
      // nodeMap fully updated before deriving edges
      setNodes(nds => [...nds, ...newNodes]);
      syncEdges();
    }
  
    const onPaneClick = useCallback((event: React.MouseEvent) => {
      setMenuOrigin({ x: event.clientX, y: event.clientY });
    }, []);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onPaneClick={onPaneClick}
        fitView
        minZoom={0.1}
        maxZoom={4}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        style={{ background: "#e8e8e8" }}
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0.5, 0.5]}
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={GRID_SIZE}
          size={10}
          lineWidth={0.5}
          color="rgba(0,0,0, 0.5)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Radial menu rendered outside ReactFlow so it's in screen-space */}
      {menuOrigin && (
        <RadialMenu
          origin={menuOrigin}
          onClose={() => setMenuOrigin(null)}
          onAddBlock={(id) => addBlockNode(id)}
          onAddChannel={(id) => addChannelNode(id)}
        />
      )}
    </>
  );
}

export default function InfiniteCanvasFlow() {
  return (
    <div style={{ width: "100vw", height: "100vh", borderRadius: 12, overflow: "hidden", position: "relative" }}>
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}