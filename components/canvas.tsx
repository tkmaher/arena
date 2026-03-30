"use client";
import { useCallback, useState, useMemo, useRef } from "react";
import RadialMenu from "@/components/radialmenu";
import InfoPanel from "@/components/infopanel";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  Edge,
  MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import FloatingEdge from '@/components/flow/FloatingEdge';
import FloatingConnectionLine from '@/components/flow/FloatingConnectionLine';

import BlockProp from "@/components/node";
import { getBlock, getChannel, getConnections, getChildren } from "@/scripts/getBlock";
import { Block, Channel, ChildrenStatus, ConnectionStatus } from "@/types/arena";
import { CanvasNode, NodeMeta } from "@/types/reactflow";

const GRID_SIZE = 250;

const nodeTypes = { Canvas: BlockProp };
const edgeTypes = { floating: FloatingEdge };

// Encode a grid coordinate as a string key for Set lookups.
// Plain objects cannot be used in a Set because equality is by reference,
// so `set.has({ x: 0, y: 0 })` always returns false.
function posKey(x: number, y: number) {
  return `${x},${y}`;
}

function deriveEdges(nodeMap: Map<string, NodeMeta>): Edge[] {
  const edges: Edge[] = [];
  for (const [parentId, data] of nodeMap.entries()) {
    if (!data.onCanvas) continue;
    for (const childId of data.children) {
      if (nodeMap.get(childId)?.onCanvas) {
        edges.push({
          id: `${parentId}-${childId}`,
          source: parentId.toString(),
          target: childId.toString(),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#000",
          },
          type: 'floating',
        });
      }
    }
  }
  return edges;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [menuOrigin, setMenuOrigin] = useState<{ x: number; y: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep mutable layout state in refs so it's scoped to this component
  // instance and doesn't persist across hot reloads.
  const nodeMap = useRef<Map<string, NodeMeta>>(new Map());
  const availablePositions = useRef<{ x: number; y: number }[]>([{ x: 0, y: 0 }]);
  const occupiedKeys = useRef<Set<string>>(new Set());

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedId),
    [nodes, selectedId]
  );

  const syncEdges = useCallback(() => {
    setEdges(deriveEdges(nodeMap.current));
  }, [setEdges]);

  function getNextPosition() {
    const position = availablePositions.current.length
      ? availablePositions.current.shift()!
      : { x: 0, y: 0 };

    occupiedKeys.current.add(posKey(position.x, position.y));

    for (let i = position.x - 1; i <= position.x + 1; i++) {
      for (let j = position.y - 1; j <= position.y + 1; j++) {
        if (i === position.x && j === position.y) continue;
        if (!occupiedKeys.current.has(posKey(i, j))) {
          availablePositions.current.push({ x: i, y: j });
        }
      }
    }
    return position;
  }

  function addConnection(connection: Block | Channel, child: string, onCanvas: boolean) {
    const map = nodeMap.current;
    if (!map.has(connection.id)) {
      map.set(connection.id, { onCanvas, children: [child] });
    } else {
      map.get(connection.id)!.onCanvas = onCanvas;
      map.get(connection.id)!.children.push(child);
    }
  }

  function addChild(connection: Block | Channel, parent: string, onCanvas: boolean) {
    const map = nodeMap.current;
    if (!map.has(connection.id)) map.set(connection.id, { onCanvas, children: [] });
    if (!map.has(parent)) map.set(parent, { onCanvas, children: [connection.id] });
    else map.get(parent)!.children.push(connection.id);
  }

  async function fetchMoreConnections(id: string, connectionStatus: ConnectionStatus, type: string) {
    if (connectionStatus.complete) return;
    const conn = await getConnections(id, type, connectionStatus.page);

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== id.toString()) return node;
        const prevObj = node.data.object as Block;
        return {
          ...node,
          data: {
            ...node.data,
            object: {
              ...prevObj,
              connectionStatus: {
                complete: conn.complete,
                page: conn.page,
                connections: [...prevObj.connectionStatus.connections, ...conn.connections],
              },
            },
          },
        } satisfies CanvasNode;
      })
    );
    syncEdges();
  }

  async function fetchMoreChildren(id: string, childrenStatus: ChildrenStatus) {
    if (childrenStatus.complete) return;
    const chil = await getChildren(id, childrenStatus.page);

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== id.toString()) return node;
        const prevObj = node.data.object as Channel;
        return {
          ...node,
          data: {
            ...node.data,
            object: {
              ...prevObj,
              childrenStatus: {
                complete: chil.complete,
                page: chil.page,
                children: [...prevObj.childrenStatus.children, ...chil.children],
              },
            },
          },
        } satisfies CanvasNode;
      })
    );
    syncEdges();
  }

  async function addBlockNode(id: string, data?: Block) {
    const map = nodeMap.current;
    if (map.has(id) && map.get(id)?.onCanvas) return false;

    const block = data ?? await getBlock(id);
    if (!block) return false;

    const newNodes: CanvasNode[] = [];

    function collectNode(nodeId: string, obj: Block | Channel) {
      // Use && here: skip only if the node is already on the canvas.
      // A node that exists in the map but is off-canvas should still be rendered.
      if (map.has(nodeId) && map.get(nodeId)?.onCanvas) return;
      const pos = getNextPosition();
      map.set(nodeId, { onCanvas: true, children: map.get(nodeId)?.children ?? [] });
      newNodes.push({
        id: nodeId.toString(),
        type: "Canvas",
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

    setNodes(nds => [...nds, ...newNodes]);
    syncEdges();
    return true;
  }

  async function addChannelNode(id: string, data?: Channel) {
    const map = nodeMap.current;
    if (map.has(id) && map.get(id)?.onCanvas) return false;

    const channel = data ?? await getChannel(id);
    if (!channel) return false;
    id = channel.id;

    const newNodes: CanvasNode[] = [];

    function collectNode(nodeId: string, obj: Block | Channel) {
      if (map.has(nodeId) && map.get(nodeId)?.onCanvas) return;
      const pos = getNextPosition();
      map.set(nodeId, { onCanvas: true, children: map.get(nodeId)?.children ?? [] });
      newNodes.push({
        id: nodeId.toString(),
        type: "Canvas",
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

    setNodes(nds => [...nds, ...newNodes]);
    syncEdges();
    return true;
  }

  async function addNode(id: string) {
    // URL path — determine block vs channel from the path segment.
    if (id.includes("/")) {
      const slug = id.slice(id.lastIndexOf('/') + 1);
      if (id.includes("/block/")) {
        const ok = await addBlockNode(slug);
        if (!ok) alert("Couldn't add block — check the URL and try again.");
      } else {
        const ok = await addChannelNode(slug);
        if (!ok) alert("Couldn't add channel — check the URL and try again.");
      }
      return;
    }

    // Raw ID — try block first, then channel. The API layer handles its own
    // errors and returns null/false, so no try/catch is needed here.
    if (await addBlockNode(id)) return;
    if (await addChannelNode(id)) return;

    alert("Couldn't find a block or channel with that ID.");
  }

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setMenuOrigin({ x: event.clientX, y: event.clientY });
  }, []);

  return (
    <>
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        onNodeClick={(_event, node) => {
          setSelectedId(node.id);
          setInfoOpen(true);
        }}
        connectionLineComponent={FloatingConnectionLine}
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={GRID_SIZE}
          size={10}
          lineWidth={0.5}
          color="rgba(0,0,0, 0.5)"
        />
        <Controls showInteractive={false} />
        {infoOpen &&
          <InfoPanel
            current={selectedNode?.data.object}
            connectionFetcher={(id, connectionStatus, type) =>
              fetchMoreConnections(id, connectionStatus, type)
            }
            childrenFetcher={(id, childrenStatus) =>
              fetchMoreChildren(id, childrenStatus)
            }
          />
        }
      </ReactFlow>

      {menuOrigin &&
        <RadialMenu
          origin={menuOrigin}
          onClose={() => setMenuOrigin(null)}
          onAdd={(id) => addNode(id)}
        />
      }
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
