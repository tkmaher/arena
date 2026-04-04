"use client";

import { useCallback, useRef, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  useReactFlow,
} from "@xyflow/react";

import { Graph, PositionAllocator, INITIAL_CANVAS_LIMIT } from "@/lib/graph";
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
  addNode: (idOrPath: string, mousePos: MousePos) => Promise<void>;
  addRandom: (mousePos: MousePos) => Promise<void>;
  toggleNode: (id: string | number, body: Block | Channel, linkedToId?: string) => Promise<void>;
  removeNode: (id: string) => void;
  fetchMoreConnections: (id: string, status: ConnectionStatus, type: string) => Promise<void>;
  fetchMoreChildren: (id: string, status: ChildrenStatus) => Promise<void>;
  onNodeDrag: (_event: React.MouseEvent, node: CanvasNode) => void;
}

export interface MousePos {
  x: number,
  y: number
}

export function useGraphEngine(): GraphEngineAPI {
  const graph = useRef(new Graph());
  const positions = useRef(new PositionAllocator());

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

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
    (_event: React.MouseEvent, node: CanvasNode) => {
      console.log("hello");
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
    async (id: string, mousePos?: MousePos, data?: Block): Promise<boolean> => {
      const g = graph.current;
      const nodeId = sid(id);
      if (g.isOnCanvas(nodeId)) return false;

      const block = data ?? (await getBlock(nodeId));
      if (!block) return false;

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
      return true;
    },
    [mountNode, flush]
  );

  const addChannelNode = useCallback(
    async (id: string, mousePos?: MousePos, data?: Channel): Promise<boolean> => {
      const g = graph.current;
      const channel = data ?? (await getChannel(sid(id)));
      if (!channel) return false;

      const nodeId = sid(channel.id);
      if (g.isOnCanvas(nodeId)) return false;

      mountNode(nodeId, channel, mousePos);

      if (!data) {
        for (const conn of channel.connectionStatus.connections) {
          g.link(sid(conn.id), nodeId);
        }
        let shown = 0;
        for (const child of channel.childrenStatus.children) {
          const childId = sid(child.id);
          g.link(nodeId, childId);
          if (shown++ < INITIAL_CANVAS_LIMIT) {
            mountNode(childId, child, mousePos);
          }
        }
      }

      flush();
      return true;
    },
    [mountNode, flush]
  );

  const addNode = useCallback(
    async (idOrPath: string, mousePos: MousePos): Promise<void> => {
      if (idOrPath.includes("/")) {
        const slug = idOrPath.slice(idOrPath.lastIndexOf("/") + 1);
        const ok = idOrPath.includes("/block/")
          ? await addBlockNode(slug, mousePos)
          : await addChannelNode(slug, mousePos);
        if (!ok) alert(`Error adding block or channel with URL ${idOrPath}.`);
        return;
      }
      if (await addBlockNode(idOrPath, mousePos)) return;
      if (await addChannelNode(idOrPath, mousePos)) return;
      alert(`Couldn't find a block or channel with ID ${idOrPath}.`);
    },
    [addBlockNode, addChannelNode]
  );

  const addRandom = useCallback(
    async (mousePos: MousePos): Promise<void> => {
      console.log("Adding random node...");
      const randomID = RandomChannels[Math.floor(Math.random() * RandomChannels.length)];
      await addNode(randomID, mousePos);
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

  // ── Pagination ────────────────────────────────────────────────────────────

  const fetchMoreConnections = useCallback(
    async (nodeId: string, status: ConnectionStatus, type: string): Promise<void> => {
      if (status.complete) return;

      
      const g = graph.current;
      const node = g.get(sid(nodeId));
      if (!node?.object) return;
      
      const result = await getConnections(nodeId, type, status.page);
      
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

      const result = await getChildren(nodeId, status.page);

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
    onNodeDrag,
    fetchMoreConnections,
    fetchMoreChildren,
  };
}