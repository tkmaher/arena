"use client";
import { useCallback, useRef, useState, useMemo } from "react";
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
  useReactFlow,
  Panel,
  type Node,
  Edge,
  MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import FloatingEdge from '@/components/flow/FloatingEdge';
import FloatingConnectionLine from '@/components/flow/FloatingConnectionLine';

import BlockProp from "@/components/node";
import { getBlock, getChannel, getConnections, getChildren } from "@/scripts/getBlock";
import { Block, Channel, ChildrenStatus, ConnectionStatus } from "@/types/arena";

const GRID_SIZE = 250;

interface NodeData { onCanvas: boolean; children: string[] }
const nodeMap = new Map<string, NodeData>();
const availablePositions: { x: number; y: number }[] = [{ x: 0, y: 0 }];
const occupiedPositions = new Set<{ x: number; y: number }>();

const nodeTypes = { Canvas: BlockProp };
const edgeTypes = { floating: FloatingEdge };

function deriveEdges(): Edge[] {
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
  console.log("Derived edges:", edges);
  return edges;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function CanvasInner() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [menuOrigin, setMenuOrigin] = useState<{ x: number; y: number } | null>(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selectedNode = useMemo(
      () => nodes.find(n => n.id === selectedId),
      [nodes, selectedId]
    );
    console.log("Selected node:", selectedNode);

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

    async function fetchMoreConnections(id: string, connectionStatus: ConnectionStatus, type: string) {
      if (connectionStatus.complete) return;
      const conn: ConnectionStatus = await getConnections(id, type, connectionStatus.page);
      console.log("Fetched more connections:", conn);
      setNodes((nds: Node[]) =>
      nds.map((node: Node) => {
        if (node.id === id.toString()) {
          return {
            ...node,
            data: {
              ...node.data,
              object: {
                ...node.data.object,
                connectionStatus: {
                  complete: conn.complete,
                  page: conn.page,
                  connections: [
                    ...node.data.object.connectionStatus.connections,
                    ...conn.connections
                  ]
                }
              }
            }
          };
        }
        return node;
      })
    );
      syncEdges();
    }

    async function fetchMoreChildren(id: string, childrenStatus: ChildrenStatus) {
      if (childrenStatus.complete) return;
      const chil: ChildrenStatus = await getChildren(id, childrenStatus.page);
      console.log("Fetched more connections:", chil);
      setNodes((nds: Node[]) =>
      nds.map((node: Node) => {
        if (node.id === id.toString()) {
          return {
            ...node,
            data: {
              ...node.data,
              object: {
                ...node.data.object,
                childrenStatus: {
                  complete: chil.complete,
                  page: chil.page,
                  children: [
                    ...node.data.object.childrenStatus.children,
                    ...chil.children
                  ]
                }
              }
            }
          };
        }
        return node;
      })
    );
      syncEdges();
    }
  
    async function addBlockNode(id: string, data?: Block) {
        if (nodeMap.has(id) && nodeMap.get(id)?.onCanvas) return;
        const block = data ?? await getBlock(id);
        if (!block) return;
        const newNodes: Node[] = [];
    
        function collectNode(nodeId: string, obj: Block | Channel) {
            if (nodeMap.has(nodeId) || nodeMap.get(nodeId)?.onCanvas) return;
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
        onNodeClick={(event, node: Node) => {
          if (infoOpen) setSelectedId(node.id);
        }}
        onNodeDoubleClick={(event, node: Node) => {
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

      {/* Radial menu rendered outside ReactFlow so it's in screen-space */}
      {menuOrigin && 
        <RadialMenu
          origin={menuOrigin}
          onClose={() => setMenuOrigin(null)}
          onAddBlock={(id) => addBlockNode(id)}
          onAddChannel={(id) => addChannelNode(id)}
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