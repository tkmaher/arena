"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  type Edge,
  Panel,
  ControlButton,
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
import { GraphContext } from "@/context/graphcontext";

const nodeTypes = { Canvas: BlockProp };
const edgeTypes = { floating: FloatingEdge };

function CanvasInner() {
  const engine = useGraphEngine();

  const [menuOrigin, setMenuOrigin] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);

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

  const { setCenter, getZoom } = useReactFlow();

  useEffect(() => {
    if (!selectedId || dragging) return;
  
    const node = engine.nodes.find(n => n.id === selectedId);
    if (!node) return;
  
    const zoom = getZoom();
  
    let { x, y } = node.position;
  
    if (infoOpen) {
      const screenOffset = window.innerWidth * 0.25;
      const flowOffset = screenOffset / zoom;
  
      x = x + flowOffset;
    }
  
    setCenter(x, y, {
      zoom,
      duration: 300,
    });
  
  }, [selectedId, infoOpen, engine.nodes]);

  const keyDownEvent = useCallback((e: any) => {
    if (e.key === "Escape") {
      setSelectedId(null);
      setInfoOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", keyDownEvent);
    return () => window.removeEventListener("keydown", keyDownEvent);
  }, [keyDownEvent]);

  const onDrag = (event: React.MouseEvent, node: CanvasNode) => {
    if (dragging) {
      setDragging(false);
      engine.onNodeDrag(node);
    } else {
      setDragging(true);
      setSelectedId(node.id);
      setInfoOpen(true);
    }
  };

  return (
    <GraphContext.Provider 
      value={{ 
        removeNode: engine.removeNode,
        selectedOnGraph: selectedId,
      }}
    >
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
        zoomOnDoubleClick={true}
        multiSelectionKeyCode="Shift"
        style={{ background: "#e8e8e8" }}
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0.5, 0.5]}
        onNodeClick={(_event, node) => {
          setSelectedId(node.id);
          setInfoOpen(true);
        }}
        connectionLineComponent={FloatingConnectionLine}
        onNodeDragStart={onDrag}
        onNodeDragStop={onDrag}
        autoPanOnNodeFocus={true}
        autoPanOnNodeDrag={false}
        deleteKeyCode={null} 
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={GRID_SIZE}
          size={10}
          lineWidth={0.5}
          color="rgba(0,0,0,0.5)"
        />
        <Controls showInteractive={false}>
          <ControlButton>
            <img 
              className="delete-all svg" 
              onClick={() => setConfirmRemoveAll(true)}
            />
          </ControlButton>
        </Controls>
      </ReactFlow>
      {confirmRemoveAll && <div className="confirm" onClick={() => setConfirmRemoveAll(false)}>
        <p className="info-title">Remove all nodes?</p>
        <div className="confirm-toolbar">
          <button onClick={engine.removeAllNodes} className="node-toolbar-button react-flow__controls popup-menu menu-title">
            Yes
          </button>
          <button onClick={() => setConfirmRemoveAll(false)} className="node-toolbar-button react-flow__controls popup-menu menu-title">
            No
          </button>
        </div>
      </div>}

      <InfoPanel
        current={infoOpen ? selectedNode?.data.object : undefined}
        connectionFetcher={engine.fetchMoreConnections}
        childrenFetcher={engine.fetchMoreChildren}
        checkNodeVisible={id => engine.visibleIds.has(String(id))}
        makeNodeVisible={makeNodeVisible}
        closePanel={() => setInfoOpen(false)}
        setSelected={(id: string) => { 
          setSelectedId(String(id)); 
          engine.setSelectedNode(String(id));
        }}
      />

      {menuOrigin && (
        <RadialMenu
          origin={menuOrigin}
          onClose={() => setMenuOrigin(null)}
          onAdd={async (id) => {
            const res = await engine.addNode(id, menuOrigin);
            if (res) {
              setSelectedId(res);
              engine.setSelectedNode(res);
              setInfoOpen(true);
            }
          }}
          onRandom={async () => {
            const res = await engine.addRandom(menuOrigin);
            if (res) {
              setSelectedId(res);
              engine.setSelectedNode(res);
              setInfoOpen(true);
            }
          }}
        />
      )}
    </GraphContext.Provider>
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