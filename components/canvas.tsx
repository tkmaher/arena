"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  type Edge,
  ControlButton,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useGraphEngine } from "@/hooks/useGraphEngine";
import { GRID_SIZE } from "@/lib/graph";

import BlockProp from "@/components/node";
import About from "@/components/ui/about";
import FloatingEdge from "@/components/flow/FloatingEdge";
import FloatingConnectionLine from "@/components/flow/FloatingConnectionLine";
import RadialMenu from "@/components/ui/radialmenu";
import InfoPanel from "@/components/ui/infopanel";
import type { CanvasNode } from "@/types/reactflow";
import type { AuthUser, Block, Channel, Group, ToggleOptions, User } from "@/types/arena";
import { GraphContext } from "@/context/graphcontext";
import NodeStats from "@/components/ui/nodestats";

import { motion } from "framer-motion";
import Upload from "./ui/upload";
import CreatePopup from "./ui/createpopup";

const nodeTypes = { Canvas: BlockProp };
const edgeTypes = { floating: FloatingEdge };

function CanvasInner() {
  const engine = useGraphEngine();

  const [menuOrigin, setMenuOrigin] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleteAll, setDeleteAll] = useState(false);
  const [about, setAbout] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [uploader, setUploader] = useState(false);
  const [createPopupOpen, setCreatePopupOpen] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const userHandler = useCallback(async (token: string | null) => {
    if (!token) {
      setAuthUser(null);
      return;
    }
    // Store token as HttpOnly cookie via edge function
    await fetch("/api/set-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  
    const res = await engine.hydrateFromAuthUser(); 
    if (res) {
      setAuthUser(res);
      setSelectedId(res.user.id);
    }
  }, []);
  
  useEffect(() => {
    engine.hydrateFromAuthUser().then(res => {
      if (res) setAuthUser(res);
    });
  }, []);
  
  const selectedNode = useMemo(
    () => engine.nodes.find(n => n.id === selectedId),
    [engine.nodes, selectedId]
  );

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setMenuOrigin({ x: event.clientX, y: event.clientY });
  }, []);

  const makeNodeVisible = useCallback(
    (data: ToggleOptions) => {
      engine.toggleNode(data);
    },
    [engine, selectedId]
  );

  const handleViewerOpen = useCallback((val: boolean) => {
    setImageViewerOpen(val);
  }, [setImageViewerOpen]);

  const handleCreatePopupOpen = useCallback((val: boolean) => {
    if (!val) setCreatePopupOpen(null);
  }, [setCreatePopupOpen]);

  const { setCenter, getZoom, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    if (!selectedId || dragging) return;
  
    const node = engine.nodes.find(n => n.id === selectedId);
    if (!node) return;
  
    const zoom = getZoom();
  
    let { x, y } = node.position;
  
    if (infoOpen) {
      const screenOffset = window.innerWidth * -0.15;
      const flowOffset = screenOffset / zoom;
  
      if (window.innerWidth >= 768)
        x = x + flowOffset;
      else
        y = y - flowOffset;
    }
  
    setCenter(x, y, {
      zoom,
      duration: 300,
    });
  
  }, [selectedId, infoOpen]);

  const keyDownEvent = useCallback((e: any) => {
    if (imageViewerOpen || about || uploader || createPopupOpen) return;
    
    if (e.key === "Escape") {
        if (deleteAll) { setDeleteAll(false); return; }
        setSelectedId(null);
        setInfoOpen(false);
    } else if (e.key === "ArrowRight" 
      || e.key === "ArrowLeft"
      || e.key === "ArrowUp"
      || e.key === "ArrowDown") 
    {
      if (!selectedId) return;
      let direction = { lat: 0, long: 0 };
      switch (e.key) {
        case "ArrowRight":
          direction = { lat: 1, long: 0 };
          break;
        case "ArrowLeft":
          direction = { lat: -1, long: 0 };
          break;
        case "ArrowUp":
          direction = { lat: 0, long: -1 };
          break;
        case "ArrowDown":
          direction = { lat: 0, long: 1 };
          break;
      }
      const newId = engine.selectNodeByDirection(selectedId, direction);
      if (newId) {
        setSelectedId(newId);
        setInfoOpen(true);
      }
    } else if (e.key === "=" || e.key === "+") {
        zoomIn();
    } else if (e.key === "-" || e.key === "_" ) {
        zoomOut();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      if (!selectedId || deleteAll) return;
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      engine.removeNode(selectedId);
      const id = engine.getNearestNode(selectedId) ?? null;
      setSelectedId(String(id));
      engine.setSelectedNode(String(id));
    }
  }, [deleteAll, selectedId, imageViewerOpen, about, uploader, createPopupOpen]);

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
        setUser: userHandler,
        user: authUser,
        makeConnection: engine.makeConnection
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
        style={{ background: "#efefef" }}
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
        disableKeyboardA11y={true}
        selectionKeyCode={null} 
        aria-multiselectable={false}
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={GRID_SIZE}
          size={10}
          lineWidth={0.5}
          color="rgba(0,0,0,0.5)"

        />
        <Controls showInteractive={false} showFitView={false} position="bottom-right" className="controls">
          <ControlButton>
            <img 
              className="delete-all svg" 
              onClick={() => setDeleteAll(true)}
            />
          </ControlButton>
          <ControlButton>
            <img 
              src="info.svg"
              className="svg" 
              onClick={() => setAbout(true)}
            />
          </ControlButton>
          <ControlButton className="hide-display">
            <img 
              src="download.svg"
              className="svg" 
              onClick={() => engine.exportGraph()}
            />
          </ControlButton>
          <ControlButton className="hide-display">
            <img 
              src="upload.svg"
              className="svg" 
              onClick={() => setUploader(true)}
            />
          </ControlButton>
        </Controls>
      </ReactFlow>
      {deleteAll &&         
        <motion.div
          className="confirm"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setDeleteAll(false)}
        >
        <p className="info-title">Remove all nodes?</p>
        <div className="confirm-toolbar">
          <button onClick={engine.removeAllNodes} className="node-toolbar-button react-flow__controls popup-menu menu-title danger">
            Yes
          </button>
          <button onClick={() => setDeleteAll(false)} className="node-toolbar-button react-flow__controls popup-menu menu-title">
            No
          </button>
        </div>
      </motion.div>}

      {about && <About setAbout={(val: boolean) => setAbout(val)}/>}

      {uploader && <Upload 
        setUpload={(val: boolean) => setUploader(val)}
        uploadHandler={(data: any) => engine.importGraph(data)}
      />}

      {createPopupOpen != null && <CreatePopup
        setOpen={handleCreatePopupOpen}
        type={createPopupOpen}
        createBlock={engine.createBlock}
        createChannel={engine.createChannel}
      />}

      <InfoPanel
        current={infoOpen ? selectedNode?.data.object : undefined}
        connectionFetcher={engine.fetchMoreConnections}
        childrenFetcher={engine.fetchMoreChildren}
        followerFetcher={engine.fetchMoreFollowers}
        followingFetcher={engine.fetchMoreFollowing}
        checkNodeVisible={id => engine.visibleIds.has(String(id))}
        makeNodeVisible={makeNodeVisible}
        closePanel={() => setInfoOpen(false)}
        setSelected={(id: string | null) => {
          if (id == "nearest" && selectedId) id = engine.getNearestNode(selectedId) ?? null;
          setSelectedId(String(id));
          engine.setSelectedNode(String(id));
        }}
        setImageOpen={handleViewerOpen}
      />

      <NodeStats
        checkNodeVisible={id => engine.visibleIds.has(String(id))}
        makeNodeVisible={makeNodeVisible}
        setSelected={(id: string) => { 
          setSelectedId(String(id)); 
          engine.setSelectedNode(String(id));
        }}
        engine={engine}
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
          createNode={(isChannel: boolean) => {
            if (isChannel) setCreatePopupOpen("channels");
            else setCreatePopupOpen("blocks");
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
        height: "100dvh",
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