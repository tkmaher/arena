"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useGraphEngine } from "@/hooks/useGraphEngine";
import { GRID_SIZE } from "@/lib/graph";

import BlockProp from "@/components/node";
import FloatingEdge from "@/components/flow/FloatingEdge";
import FloatingConnectionLine from "@/components/flow/FloatingConnectionLine";
import RadialMenu from "@/components/radialmenu";
import InfoPanel from "@/components/infopanel";
import type { CanvasNode } from "@/types/reactflow";
import type { Block, Channel } from "@/types/arena";

const nodeTypes = { Canvas: BlockProp };
const edgeTypes = { floating: FloatingEdge };

function CanvasInner() {
  const engine = useGraphEngine();

  const [menuOrigin, setMenuOrigin] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const selectedNode = useMemo(
    () => engine.nodes.find(n => n.id === selectedId),
    [engine.nodes, selectedId]
  );

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setMenuOrigin({ x: event.clientX, y: event.clientY });
  }, []);

  // Pass selectedId so the engine can wire the edge on toggle-on
  const makeNodeVisible = useCallback(
    (id: string, body: Block | Channel) => {
      engine.toggleNode(id, body, selectedId ?? undefined);
    },
    [engine, selectedId]
  );

  return (
    <>
      <ReactFlow<CanvasNode, Edge>
        nodes={engine.nodes}
        edges={engine.edges}
        onNodesChange={engine.onNodesChange}
        onEdgesChange={engine.onEdgesChange}
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
        onNodeDrag={engine.onNodeDrag}
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={GRID_SIZE}
          size={10}
          lineWidth={0.5}
          color="rgba(0,0,0,0.5)"
        />
        <Controls showInteractive={false} />

        {infoOpen && (
          <InfoPanel
            current={selectedNode?.data.object}
            connectionFetcher={engine.fetchMoreConnections}
            childrenFetcher={engine.fetchMoreChildren}
            checkNodeVisible={id => engine.visibleIds.has(id)}
            makeNodeVisible={makeNodeVisible}
          />
        )}
      </ReactFlow>

      {menuOrigin && (
        <RadialMenu
          origin={menuOrigin}
          onClose={() => setMenuOrigin(null)}
          onAdd={engine.addNode}
        />
      )}
    </>
  );
}

export default function InfiniteCanvasFlow() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}