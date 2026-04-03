"use client";

import { useCallback, useRef, useState, useEffect } from "react";
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

  addNode: (idOrPath: string) => Promise<void>;
  /**
   * Toggle a node on/off the canvas.
   * Pass `linkedToId` to wire an edge between the toggled node and the
   * currently-selected node when it comes ON.
   */
  toggleNode: (id: string | number, body: Block | Channel, linkedToId?: string) => Promise<void>;
  removeNode: (id: string) => void;
  fetchMoreConnections: (id: string, status: ConnectionStatus, type: string) => Promise<void>;
  fetchMoreChildren: (id: string, status: ChildrenStatus) => Promise<void>;
  onNodeDrag: (_event: React.MouseEvent, node: CanvasNode) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGraphEngine(): GraphEngineAPI {
  const graph     = useRef(new Graph());
  const positions = useRef(new PositionAllocator());

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  // ── Flush graph → React state ─────────────────────────────────────────────

  const { setViewport } = useReactFlow();

  const flush = useCallback(() => {
    const g = graph.current;
    const freshNodes = g.toReactFlowNodes(); 
    const freshEdges = g.toReactFlowEdges();
    setViewport(v => ({ ...v }));
  
    setRfNodes(prev => {
      const prevMap = new Map(prev.map(n => [n.id, n]));
      return freshNodes.map(n => {
        const existing = prevMap.get(n.id);
        if (!existing) return n; 
        return {
          ...n,
          position: existing.position,
          selected: existing.selected,
        };
      });
    });
  
    setRfEdges(prev => {
      const prevMap = new Map(prev.map(e => [e.id, e]));
      return freshEdges.map(e => prevMap.get(e.id) ?? e);
    });
  
    setVisibleIds(g.canvasIds());
  }, [setRfNodes, setRfEdges]); 

  // ── Position helpers ──────────────────────────────────────────────────────

  const { screenToFlowPosition, getViewport } = useReactFlow();

  const mountNode = useCallback((id: string, object: Block | Channel): boolean => {
    const g = graph.current;
    if (g.isOnCanvas(id)) return false;
  
    const vp = getViewport();
    const centerFlow = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  
    const gridPos = positions.current.allocate(centerFlow);
    g.ensure(id, { object, gridPos, onCanvas: true });
    return true;
  }, [screenToFlowPosition, getViewport]);

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
    async (id: string, data?: Block): Promise<boolean> => {
      const g = graph.current;
      const nodeId = sid(id);
      if (g.isOnCanvas(nodeId)) return false;

      const block = data ?? (await getBlock(nodeId));
      if (!block) return false;

      mountNode(nodeId, block);

      if (!data) {
        let shown = 0;
        for (const conn of block.connectionStatus.connections) {
          const connId = sid(conn.id);
          g.link(connId, nodeId);
          if (shown++ < INITIAL_CANVAS_LIMIT) {
            mountNode(connId, conn);
          }
        }
      }

      flush();
      return true;
    },
    [mountNode, flush]
  );

  const addChannelNode = useCallback(
    async (id: string, data?: Channel): Promise<boolean> => {
      const g = graph.current;
      const channel = data ?? (await getChannel(sid(id)));
      if (!channel) return false;

      const nodeId = sid(channel.id);
      if (g.isOnCanvas(nodeId)) return false;

      mountNode(nodeId, channel);

      if (!data) {
        for (const conn of channel.connectionStatus.connections) {
          g.link(sid(conn.id), nodeId);
        }
        let shown = 0;
        for (const child of channel.childrenStatus.children) {
          const childId = sid(child.id);
          g.link(nodeId, childId);
          if (shown++ < INITIAL_CANVAS_LIMIT) {
            mountNode(childId, child);
          }
        }
      }

      flush();
      return true;
    },
    [mountNode, flush]
  );

  const addNode = useCallback(
    async (idOrPath: string): Promise<void> => {
      if (idOrPath.includes("/")) {
        const slug = idOrPath.slice(idOrPath.lastIndexOf("/") + 1);
        const ok = idOrPath.includes("/block/")
          ? await addBlockNode(slug)
          : await addChannelNode(slug);
        if (!ok) alert("Couldn't add that node — check the URL.");
        return;
      }
      if (await addBlockNode(idOrPath)) return;
      if (await addChannelNode(idOrPath)) return;
      alert("Couldn't find a block or channel with that ID.");
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
          await addChannelNode(nodeId, body as Channel);
        } else {
          await addBlockNode(nodeId, body as Block);
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
      // Guard: stub nodes (created by link() with no object) can't be updated
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
    toggleNode,
    removeNode,
    onNodeDrag,
    fetchMoreConnections,
    fetchMoreChildren,
  };
}