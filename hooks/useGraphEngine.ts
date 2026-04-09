"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  useReactFlow,
} from "@xyflow/react";

import { Graph, PositionAllocator, INITIAL_CANVAS_LIMIT, GRID_SIZE } from "@/lib/graph";
import { getBlock, getChannel, getConnections, getChildren } from "@/scripts/getBlock";
import type { Block, Channel, ChildrenStatus, ConnectionStatus } from "@/types/arena";
import type { CanvasNode } from "@/types/reactflow";

import { RandomChannels } from "@/lib/random";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Always compare / store IDs as strings — the API returns numbers at runtime. */
const sid = (id: string | number): string => String(id);

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GraphEngineAPI {
  nodes: CanvasNode[];
  edges: Edge[];
  visibleIds: Set<string>;
  onNodesChange: OnNodesChange<CanvasNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  addNode: (idOrPath: string, mousePos: MousePos) => Promise<string | null>;
  addRandom: (mousePos: MousePos) => Promise<string | null>;
  toggleNode: (id: string | number, body: Block | Channel, linkedToId?: string) => Promise<void>;
  removeNode: (id: string) => void;
  removeAllNodes: () => void;
  fetchMoreConnections: (id: string, status: ConnectionStatus, type: string) => Promise<void>;
  fetchMoreChildren: (id: string, status: ChildrenStatus) => Promise<void>;
  onNodeDrag: (node: CanvasNode) => void;
  setSelectedNode: (id: string | null) => void;
  selectNodeByDirection: (id: string, direction: {lat: number, long: number}) => string | null;
  getNearestNode: (id: string) => string | null;
  exportGraph: () => void;
  importGraph: (data: any) => void;

}

export interface MousePos {
  x: number,
  y: number
}

export function useGraphEngine(): GraphEngineAPI {
  const graph = useRef(new Graph());
  const positions = useRef(new PositionAllocator());
  const fetchLimiter = useRef<number[]>([]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const freeFetchList = useCallback(() => {
    const now = new Date();
    fetchLimiter.current = fetchLimiter.current.filter((time: number) => now.getTime() - time < 60000);
  }, [fetchLimiter]);

  useEffect(() => {
    const timerId = setInterval(() => {
      freeFetchList();
    }, 1000);

    return () => clearTimeout(timerId);
  }, [freeFetchList]); 

  function fetchOK() {
    console.log(fetchLimiter.current);
    if (fetchLimiter.current.length < 30) {
      fetchLimiter.current.push(new Date().getTime());
      return true;
    }
    alert("Request limit reached. Please wait a moment before trying again.");
    return false;
  }

  // Align nodes and edges to state

  const flush = useCallback(() => {
    const g = graph.current;
    const nextIds = g.canvasIds();
  
    setRfNodes(prev => {
      const nextIdSet = new Set(g.canvasIds());
      const fresh = g.toReactFlowNodes();
      const freshMap = new Map(fresh.map(n => [n.id, n]));
    
      const result: CanvasNode[] = [];
    
      for (const prevNode of prev) {
        if (!nextIdSet.has(prevNode.id)) continue;
    
        const freshNode = freshMap.get(prevNode.id);
    
        if (!freshNode) continue;
    
        result.push({
          ...prevNode,
          data: freshNode.data,
        });
      }
    
      // Add new nodes
      for (const n of fresh) {
        if (!prev.find(p => p.id === n.id)) {
          result.push(n);
        }
      }
    
      return result;
    });
  
    // --- EDGES ---
    setRfEdges(prev => {
      const fresh = g.toReactFlowEdges();
      const freshMap = new Map(fresh.map(e => [e.id, e]));
  
      const result: Edge[] = [];
  
      // 1. Keep existing edges
      for (const e of prev) {
        if (freshMap.has(e.id)) {
          result.push(e);
        }
      }
  
      const prevIds = new Set(prev.map(e => e.id));
  
      // 2. Add new edges
      for (const e of fresh) {
        if (!prevIds.has(e.id)) {
          result.push(e);
        }
      }
  
      return result;
    });
  
    setVisibleIds(new Set(nextIds));
  }, []);

  // ── Position helpers ──────────────────────────────────────────────────────

  const { screenToFlowPosition } = useReactFlow();

  const mountNode = useCallback(
    (id: string, object: Block | Channel, mousePos?: MousePos) => {
      const g = graph.current;
      if (g.isOnCanvas(id)) return false;
      
      const centerFlow = mousePos
        ? screenToFlowPosition(mousePos)
        : screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
  
      const gridPos = positions.current.allocate(centerFlow);
      g.ensure(id, { object, gridPos, onCanvas: true });
  
      return true;
    },
    [screenToFlowPosition]
  );

  const unmountNode = useCallback((id: string): boolean => {
    const g = graph.current;
    const n = g.get(id);
    if (!n?.onCanvas) return false;
    g.setOnCanvas(id, false);
    positions.current.release(n.gridPos.x, n.gridPos.y);
    return true;
  }, []);

  const onNodeDrag = useCallback(
    (node: CanvasNode) => {
      console.log("dragging");
      const g = graph.current;
      const n = g.get(node.id);
      if (!n) return;
      if (!n.manualPos) {
        positions.current.release(n.gridPos.x, n.gridPos.y);
      }
      n.manualPos = node.position;
    },
  []);

  // ── Node operations ───────────────────────────────────────────────────────

  const addBlockNode = useCallback(
    async (id: string, mousePos?: MousePos, data?: Block): Promise<string | null> => {
      const g = graph.current;
      const nodeId = sid(id);
      if (g.isOnCanvas(nodeId)) return null;

      const block = data ?? (fetchOK() ? await getBlock(nodeId) : null);
      if (!block) return null;

      mountNode(nodeId, block, mousePos);

      if (!data) {
        let shown = 0;
        for (const conn of block.connectionStatus.connections) {
          const connId = sid(conn.id);
          g.link(connId, nodeId);
          if (shown++ < INITIAL_CANVAS_LIMIT) {
            mountNode(connId, conn, mousePos);
          }
        }
      }

      flush();
      return nodeId;
    },
    [mountNode, flush]
  );

  const addChannelNode = useCallback(
    async (id: string, mousePos?: MousePos, data?: Channel): Promise<string | null> => {
      const g = graph.current;
      const channel = data ?? (fetchOK() ? await getChannel(sid(id)) : null);
      if (!channel) return null;

      const nodeId = sid(channel.id);
      if (g.isOnCanvas(nodeId)) return null;

      mountNode(nodeId, channel, mousePos);

      if (!data) {
        for (const conn of channel.connectionStatus.connections) {
          g.link(sid(conn.id), nodeId);
        }
        let shown = 0;
        for (const child of channel.childrenStatus.children) {
          const childId = sid(child.id);
          g.link(nodeId, childId);
          if (shown + 1 < INITIAL_CANVAS_LIMIT && Math.random() < 0.5) { 
            mountNode(childId, child, mousePos);
            shown++;
          }
        }
      }

      flush();
      return nodeId;
    },
    [mountNode, flush]
  );

  const addNode = useCallback(
    async (idOrPath: string, mousePos: MousePos): Promise<string | null> => {
      let res;
      const g = graph.current;
      if (idOrPath.includes("/")) {
        const slug = idOrPath.slice(idOrPath.lastIndexOf("/") + 1);
        if (g.isOnCanvas(sid(slug))) {
          alert(`Node ${idOrPath} already exists.`);
          return null;
        }
        const ok = idOrPath.includes("/block/")
          ? res = (fetchOK() ? await addBlockNode(slug, mousePos) : null)
          : res = (fetchOK() ? await addChannelNode(slug, mousePos) : null);
        if (!ok) {
          alert(`Error adding block or channel with URL ${idOrPath}.`);
          return null;
        }
        return res;
      }
      if (g.isOnCanvas(sid(idOrPath))) {
        alert(`Node ${idOrPath} already exists.`);
        return null;
      }
      if (res = fetchOK() ? await addBlockNode(idOrPath, mousePos) : null) return res;
      if (res = fetchOK() ? await addChannelNode(idOrPath, mousePos) : null) return res;
      alert(`Couldn't find a block or channel with ID ${idOrPath}.`);
      return null;
    },
    [addBlockNode, addChannelNode]
  );

  const addRandom = useCallback(
    async (mousePos: MousePos): Promise<string | null> => {
      const randomID = RandomChannels[Math.floor(Math.random() * RandomChannels.length)];
      RandomChannels.splice(RandomChannels.indexOf(randomID), 1);
      console.log(RandomChannels);
      return (fetchOK() ? await addNode(randomID, mousePos) : null);
    },
    [addBlockNode, addChannelNode]
  );

  const removeNode = useCallback(
    (id: string) => {
      unmountNode(sid(id));
      flush();
    },
    [unmountNode, flush]
  );

  const removeAllNodes = useCallback(() => {
    const g = graph.current;
    for (const id of g.canvasIds()) {
      unmountNode(id);
    }
    flush();
  }, [flush, unmountNode]);

  const toggleNode = useCallback(
    async (
      id: string | number,
      body: Block | Channel,
      linkedToId?: string
    ): Promise<void> => {
      const g = graph.current;
      const nodeId = sid(id);

      if (g.isOnCanvas(nodeId)) {
        unmountNode(nodeId);
      } else {
        if (body.type === "Channel") {
          await addChannelNode(nodeId, undefined, body as Channel);
        } else {
          await addBlockNode(nodeId, undefined, body as Block);
        }

        // Wire edge between this node and the selected node
        if (linkedToId) {
          const lId = sid(linkedToId);
          if (body.type === "Channel") {
            g.link(nodeId, lId); // channel is parent of the selected block
          } else {
            g.link(lId, nodeId); // selected channel/block owns this block
          }
        }
      }

      flush();
    },
    [unmountNode, addChannelNode, addBlockNode, flush]
  );

  const setSelectedNode = useCallback((id: string | null) => {
    setRfNodes(nodes =>
      nodes.map(n => ({
        ...n,
        selected: id !== null && n.id === id,
      }))
    );
  }, []);

  const selectNodeByDirection = useCallback((id: string, direction: {lat: number, long: number}) => {
    const g = graph.current;
    let currPos = g.get(id)?.gridPos;
    if (!currPos) return null;
  
    const scaledPos = g.get(id)?.manualPos ?? {
      x: currPos.x * GRID_SIZE,
      y: currPos.y * GRID_SIZE,
    };
  
    const LATERAL_PENALTY = 10;
  
    let bestScore = Infinity;
    let bestNode = null;
  
    for (const node of g.toReactFlowNodes()) {
      if (node.id === id) continue;
  
      const dx = node.position.x - scaledPos.x;
      const dy = node.position.y - scaledPos.y;
  
      const axial = dx * direction.lat + dy * direction.long;
      if (axial <= 0) continue;
  
      const distSq = dx * dx + dy * dy;
      const lateral = Math.sqrt(Math.max(0, distSq - axial * axial));
      const score = lateral * LATERAL_PENALTY + axial;
  
      if (score < bestScore) {
        bestScore = score;
        bestNode = node.id;
      }
    }
  
    if (bestNode) setSelectedNode(bestNode);
    return bestNode;
  }, [positions, setSelectedNode]);

  const getNearestNode = useCallback((id: string): string | null => {
    const g = graph.current;
    const targetPos = g.get(id)?.gridPos;
    if (!targetPos) return null;

    let bestDist = Infinity;
    let bestNode = null;

    for (const node of g.toReactFlowNodes()) {
      if (node.id === id) continue;

      const nodePos = g.get(node.id)?.gridPos;
      if (!nodePos) continue;

      const dx = nodePos.x - targetPos.x;
      const dy = nodePos.y - targetPos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDist) {
        bestDist = distSq;
        bestNode = node.id;
      }
    }

    if (bestNode) setSelectedNode(bestNode);
    return bestNode;
  }, [positions, setSelectedNode]);


  // ── Pagination ────────────────────────────────────────────────────────────

  const fetchMoreConnections = useCallback(
    async (nodeId: string, status: ConnectionStatus, type: string): Promise<void> => {
      if (status.complete) return;

      
      const g = graph.current;
      const node = g.get(sid(nodeId));
      if (!node?.object) return;
      
      const result = fetchOK() ? await getConnections(nodeId, type, status.page) : null;
      if (!result) return;
      
      const merged = Array.from(
        new Map(
          [...status.connections, ...result.connections].map(c => [sid(c.id), c])
          ).values()
          );

      g.updateObject(sid(nodeId), {
        ...node.object,
        connectionStatus: {
          complete: result.complete,
          page: result.page,
          connections: merged,
        },
      } as Block | Channel);

      for (const c of result.connections) {
        g.link(sid(c.id), sid(nodeId));
      }

      flush();
    },
    [flush]
  );

  const fetchMoreChildren = useCallback(
    async (nodeId: string, status: ChildrenStatus): Promise<void> => {
      if (status.complete) return;

      const g = graph.current;
      const node = g.get(sid(nodeId));
      // Guard: stub or non-channel nodes can't be updated
      if (!node?.object || node.object.type !== "Channel") return;

      const result = fetchOK() ? await getChildren(nodeId, status.page) : null;
      if (!result) return;

      const merged = Array.from(
        new Map(
          [...status.children, ...result.children].map(c => [sid(c.id), c])
        ).values()
      );

      g.updateObject(sid(nodeId), {
        ...node.object,
        childrenStatus: {
          complete: result.complete,
          page: result.page,
          children: merged,
        },
      } as Channel);

      for (const child of result.children) {
        g.link(sid(nodeId), sid(child.id));
      }

      flush();
    },
    [flush]
  );

  // -- Upload/download

  const exportGraph = useCallback(() => {
    graph.current.exportGraph();
  }, [])

  const importGraph = useCallback((data: any) => {
    // 1. Restore graph structure
    positions.current = new PositionAllocator();
    graph.current = new Graph();
    graph.current.importGraph(data);
  
    const alloc = positions.current;
    for (const n of data) {
      
      if (n.onCanvas) {
        alloc.occupy(n.gridPos.x, n.gridPos.y);
      }
    }
  
    flush();
  }, [flush]);


  // ── Return ────────────────────────────────────────────────────────────────

  return {
    nodes: rfNodes,
    edges: rfEdges,
    visibleIds,
    onNodesChange,
    onEdgesChange,
    addNode,
    addRandom,
    toggleNode,
    removeNode,
    removeAllNodes,
    onNodeDrag,
    fetchMoreConnections,
    fetchMoreChildren,
    setSelectedNode,
    selectNodeByDirection,
    getNearestNode,
    exportGraph,
    importGraph
  };
}