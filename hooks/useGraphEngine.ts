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
import {
  getBlock,
  getChannel,
  getUser,
  getConnections,
  getChildren,
  getFollowing,
  getFollowers,
  createConnection,
  setUser,
  createBlock as createBlockAPI,
  createChannel as createChannelAPI,
  deleteChannel as deleteChannelAPI,
  getGroup,
} from "@/scripts/getBlock";
import type {
  AuthUser,
  Block,
  BlockCreation,
  Channel,
  ChannelCreation,
  ChildrenStatus,
  ConnectionStatus,
  FollowersStatus,
  FollowingStatus,
  Group,
  ToggleOptions,
  User,
} from "@/types/arena";
import type { CanvasNode } from "@/types/reactflow";

import { RandomChannels } from "@/lib/random";
import { isBlock, isChannel, isGroup, isPending, isUser } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sid = (id: string | number): string => String(id);

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GraphEngineAPI {
  nodes: CanvasNode[];
  edges: Edge[];
  visibleIds: Set<string>;
  onNodesChange: OnNodesChange<CanvasNode>;
  onEdgesChange: OnEdgesChange<Edge>;

  // ── Read / navigation ────────────────────────────────────────────────────
  addNode: (idOrPath: string, mousePos: MousePos) => Promise<string | null>;
  addRandom: (mousePos: MousePos) => Promise<string | null>;
  toggleNode: (data: ToggleOptions) => Promise<void>;
  removeNode: (id: string) => void;
  removeAllNodes: () => void;
  fetchMoreConnections: (id: string, status: ConnectionStatus, type: string) => Promise<void>;
  fetchMoreChildren: (id: string, status: ChildrenStatus, type: string) => Promise<void>;
  fetchMoreFollowers: (id: string, status: FollowersStatus, type: string) => Promise<void>;
  fetchMoreFollowing: (id: string, status: FollowingStatus) => Promise<void>;
  onNodeDrag: (node: CanvasNode) => void;
  setSelectedNode: (id: string | null) => void;
  selectNodeByDirection: (id: string, direction: { lat: number; long: number }) => string | null;
  getNearestNode: (id: string) => string | null;
  exportGraph: () => void;
  importGraph: (data: any) => void;

  // ── Authentication ──────────────────────────────────────────────────────────
  makeConnection: (id: string, type: string, channels: string[]) => Promise<void>;
  createBlock: (data: BlockCreation) => Promise<string | null>;
  createChannel: (data: ChannelCreation) => Promise<string | null>;
  deleteChannel: (id: string) => Promise<boolean>;
  hydrateFromAuthUser: () => Promise<AuthUser | null>;
}

export interface MousePos {
  x: number;
  y: number;
}

export function useGraphEngine(): GraphEngineAPI {
  const graph = useRef(new Graph());
  const positions = useRef(new PositionAllocator());
  const fetchLimiter = useRef<number[]>([]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const { user } = useGraphActions();

  let fetchCount = 30;
  switch(user?.tier) {
    case "free":
      fetchCount = 120;
      break;
    case "premium":
      fetchCount = 300;
      break;
    case "supporter":
      fetchCount = 600;
      break;
    default:
      break;
  }

  const freeFetchList = useCallback(() => {
    const now = new Date();
    fetchLimiter.current = fetchLimiter.current.filter(
      (time: number) => now.getTime() - time < 60000
    );
  }, []);

  useEffect(() => {
    const timerId = setInterval(freeFetchList, 1000);
    return () => clearTimeout(timerId);
  }, [freeFetchList]);

  function fetchOK() {
    if (fetchLimiter.current.length < fetchCount) {
      fetchLimiter.current.push(new Date().getTime());
      return true;
    }
    alert("Request limit reached. Please wait a moment before trying again.");
    return false;
  }

  // ── Sync graph → ReactFlow state ─────────────────────────────────────────

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
        result.push({ ...prevNode, data: freshNode.data });
      }
      for (const n of fresh) {
        if (!prev.find(p => p.id === n.id)) result.push(n);
      }
      return result;
    });

    setRfEdges(prev => {
      const fresh = g.toReactFlowEdges();
      const freshMap = new Map(fresh.map(e => [e.id, e]));
      const result: Edge[] = [];
      for (const e of prev) {
        if (freshMap.has(e.id)) result.push(e);
      }
      const prevIds = new Set(prev.map(e => e.id));
      for (const e of fresh) {
        if (!prevIds.has(e.id)) result.push(e);
      }
      return result;
    });

    setVisibleIds(new Set(nextIds));
  }, []);

  // ── Position helpers ──────────────────────────────────────────────────────

  const { screenToFlowPosition } = useReactFlow();

  const mountNode = useCallback(
    (id: string, object: Block | Channel | User | Group, mousePos?: MousePos) => {
      const g = graph.current;
      if (g.isOnCanvas(id)) return false;
      const centerFlow = mousePos
        ? screenToFlowPosition(mousePos)
        : screenToFlowPosition({
            x: window.innerWidth > 768 ? window.innerWidth * 0.6 : window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
      const gridPos = positions.current.allocate(centerFlow);
      const existing = g.get(id);
      g.ensure(id, { object: existing?.object ?? object, gridPos, onCanvas: true });
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

  /**
   * Remove a node from the graph entirely, cleaning up all edges.
   * Also releases its grid position if it was on-canvas.
   */
  const purgeNode = useCallback((id: string): void => {
    const g = graph.current;
    const n = g.get(id);
    if (!n) return;
    if (n.onCanvas) positions.current.release(n.gridPos.x, n.gridPos.y);
    g.remove(id);
  }, []);

  const onNodeDrag = useCallback((node: CanvasNode) => {
    const g = graph.current;
    const n = g.get(node.id);
    if (!n) return;
    if (!n.manualPos) positions.current.release(n.gridPos.x, n.gridPos.y);
    n.manualPos = node.position;
  }, []);

  // ── Individual node adders ────────────────────────────────────────────────

  const addBlockNode = useCallback(
    async (id: string, mousePos?: MousePos, data?: Block): Promise<string | null> => {
      const g = graph.current;
      const nodeId = sid(id);
      if (g.isOnCanvas(nodeId)) return null;
  
      const block = data ?? (fetchOK() ? await getBlock(nodeId) : null);
      if (!block) return null;
  
      mountNode(nodeId, block, mousePos);
  
      // Always link connections so existing on-canvas channels stay in sync,
      // but only auto-mount neighbours during a fresh fetch (no pre-supplied data).
      let shown = 0;
      for (const conn of block.connectionStatus.connections) {
        const connId = sid(conn.id);
        g.link(connId, nodeId);
  
        // Patch the channel already in the graph so it lists this block as a child
        const channelNode = g.get(connId);
        if (channelNode?.object && isChannel(channelNode.object)) {
          const existing = channelNode.object.childrenStatus.children;
          if (!existing.some(c => sid(c.id) === nodeId)) {
            g.updateObject(connId, {
              ...channelNode.object,
              childrenStatus: {
                ...channelNode.object.childrenStatus,
                children: [...existing, block],
              },
            } as Channel);
          }
        }
  
        if (!data && shown++ < INITIAL_CANVAS_LIMIT) mountNode(connId, conn, mousePos);
      }

      g.link(sid(block.owner.id), nodeId);
  
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
        g.link(sid(channel.owner.id), nodeId);
      }

      flush();
      return nodeId;
    },
    [mountNode, flush]
  );

  const addUserNode = useCallback(
    async (id: string, mousePos?: MousePos, data?: User): Promise<string | null> => {
      const g = graph.current;
      const nodeId = sid(id);
      if (g.isOnCanvas(nodeId)) return null;
      const user = data ?? (fetchOK() ? await getUser(nodeId) : null);
      if (!user) return null;
      mountNode(nodeId, user, mousePos);
      flush();
      return nodeId;
    },
    [mountNode, flush]
  );

  const addGroupNode = useCallback(
    async (id: string, mousePos?: MousePos, data?: Group): Promise<string | null> => {
      const g = graph.current;
      const nodeId = sid(id);
      if (g.isOnCanvas(nodeId)) return null;
      const group = data ?? (fetchOK() ? await getGroup(nodeId) : null);
      if (!group) return null;
      mountNode(nodeId, group, mousePos);
      flush();
      return nodeId;
    },
    [mountNode, flush]
  );

  // ── Public add / remove ───────────────────────────────────────────────────

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
          ? (res = fetchOK() ? await addBlockNode(slug, mousePos) : null)
          : (res = fetchOK() ? await addChannelNode(slug, mousePos) : null);
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
      if ((res = fetchOK() ? await addBlockNode(idOrPath, mousePos) : null)) return res;
      if ((res = fetchOK() ? await addChannelNode(idOrPath, mousePos) : null)) return res;
      alert(`Couldn't find a block or channel with ID ${idOrPath}.`);
      return null;
    },
    [addBlockNode, addChannelNode]
  );

  const addRandom = useCallback(
    async (mousePos: MousePos): Promise<string | null> => {
      const randomID = RandomChannels[Math.floor(Math.random() * RandomChannels.length)];
      RandomChannels.splice(RandomChannels.indexOf(randomID), 1);
      return fetchOK() ? await addNode(randomID, mousePos) : null;
    },
    [addNode]
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
    for (const id of g.canvasIds()) unmountNode(id);
    flush();
  }, [flush, unmountNode]);

  const toggleNode = useCallback(
    async (data: ToggleOptions): Promise<void> => {
      const g = graph.current;
      const nodeId = sid(data.id);
  
      if (g.isOnCanvas(nodeId)) {
        unmountNode(nodeId);
      } else {
        if (isChannel(data.body)) {
          await addChannelNode(nodeId, undefined, data.body);
        } else if (isUser(data.body)) {
          await addUserNode(nodeId, undefined, data.body);
        } else if (isBlock(data.body)) {
          await addBlockNode(nodeId, undefined, data.body);
        } else if (isGroup(data.body)) {
          await addGroupNode(nodeId, undefined, data.body);
        }
        if (data.linkedToId) {
          const lId = sid(data.linkedToId);
          if (isChannel(data.body)) {
            g.link(nodeId, lId);                     
          } else if (data.linkOptions?.reverseLink) {
            g.link(nodeId, lId);                     
          } else {
            g.link(lId, nodeId);                     
          }
        }
      }
      flush();
    },
    [unmountNode, addChannelNode, addUserNode, addBlockNode, flush, addGroupNode]
  );

  // ── Selection ─────────────────────────────────────────────────────────────

  const setSelectedNode = useCallback((id: string | null) => {
    setRfNodes(nodes =>
      nodes.map(n => ({ ...n, selected: id !== null && n.id === id }))
    );
  }, []);

  const selectNodeByDirection = useCallback(
    (id: string, direction: { lat: number; long: number }) => {
      const g = graph.current;
      const currPos = g.get(id)?.gridPos;
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
    },
    [setSelectedNode]
  );

  const getNearestNode = useCallback(
    (id: string): string | null => {
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
    },
    [setSelectedNode]
  );

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
        new Map([...status.connections, ...result.connections].map(c => [sid(c.id), c])).values()
      );
      g.updateObject(sid(nodeId), {
        ...node.object,
        connectionStatus: { complete: result.complete, page: result.page, connections: merged },
      } as Block | Channel);
      for (const c of result.connections) g.link(sid(c.id), sid(nodeId));
      flush();
    },
    [flush]
  );

  const fetchMoreChildren = useCallback(
    async (nodeId: string, status: ChildrenStatus, type: string): Promise<void> => {
      if (status.complete) return;
      const g = graph.current;
      const node = g.get(sid(nodeId));
      if (!node?.object || node.object.type === "Block") return;
      const result = fetchOK() ? await getChildren(nodeId, status.page, type) : null;
      if (!result) return;
      const merged = Array.from(
        new Map([...status.children, ...result.children].map(c => [sid(c.id), c])).values()
      );
      g.updateObject(sid(nodeId), {
        ...node.object,
        childrenStatus: { complete: result.complete, page: result.page, children: merged },
      } as Channel | User | Group);
      for (const child of result.children) g.link(sid(nodeId), sid(child.id));
      flush();
    },
    [flush]
  );

  const fetchMoreFollowers = useCallback(
    async (nodeId: string, status: FollowersStatus, type: string): Promise<void> => {
      if (status.complete) return;
      const g = graph.current;
      const node = g.get(sid(nodeId));
      if (!node?.object || (node.object.type !== "User" && node.object.type !== "Group")) return;
      const result = fetchOK() ? await getFollowers(nodeId, status.page, type) : null;
      if (!result) return;
      const merged = Array.from(
        new Map([...status.followers, ...result.followers].map(u => [sid(u.id), u])).values()
      );
      g.updateObject(sid(nodeId), {
        ...node.object,
        followersStatus: { complete: result.complete, page: result.page, followers: merged },
      } as User | Group);
      for (const follower of result.followers) g.link(sid(nodeId), sid(follower.id));
      flush();
    },
    [flush]
  );

  const fetchMoreFollowing = useCallback(
    async (nodeId: string, status: FollowingStatus): Promise<void> => {
      if (status.complete) return;
      const g = graph.current;
      const node = g.get(sid(nodeId));
      if (!node?.object || node.object.type !== "User") return;
      const result = fetchOK() ? await getFollowing(nodeId, status.page) : null;
      if (!result) return;
      const merged = Array.from(
        new Map([...status.following, ...result.following].map(u => [sid(u.id), u])).values()
      );
      g.updateObject(sid(nodeId), {
        ...node.object,
        followingStatus: { complete: result.complete, page: result.page, following: merged },
      } as User);
      for (const following of result.following) g.link(sid(following.id), sid(nodeId));
      flush();
    },
    [flush]
  );

  // ── Import / export ───────────────────────────────────────────────────────

  const exportGraph = useCallback(() => {
    graph.current.exportGraph();
  }, []);

  const importGraph = useCallback(
    (data: any) => {
      positions.current = new PositionAllocator();
      graph.current = new Graph();
      graph.current.importGraph(data);
      const alloc = positions.current;
      for (const n of data) {
        if (n.onCanvas) alloc.occupy(n.gridPos.x, n.gridPos.y);
      }
      flush();
    },
    [flush]
  );

  // ── Connection management ─────────────────────────────────────────────────

  const makeConnection = useCallback(
    async (id: string, type: string, channels: string[]): Promise<void> => {
      const g = graph.current;
      const node = g.get(sid(id));
  
      if (!node || (!isBlock(node.object) && !isChannel(node.object))) return;

  
      const ok = await createConnection(id, type, channels);
      if (!ok) return;
  
      const newConnections = [...node.object.connectionStatus.connections];
  
      for (const c of channels) {
        const cid = sid(c);
        const channelNode = g.get(cid);
      
        if (!channelNode || !isChannel(channelNode.object)) continue;
      
        const existingChildren = channelNode.object.childrenStatus.children;
        const childExists = existingChildren.some(
          child => sid(child.id) === sid(id)
        );
      
        const updatedChannel: Channel = {
          ...channelNode.object,
          childrenStatus: {
            ...channelNode.object.childrenStatus,
            children: childExists
              ? existingChildren
              : [...existingChildren, node.object],
          },
        };
      
        g.updateObject(cid, updatedChannel);
        g.link(cid, sid(id));
      
        if (!newConnections.some(conn => sid(conn.id) === cid)) {
          newConnections.push(updatedChannel);
        }
      }
  
      g.updateObject(sid(id), {
        ...node.object,
        connectionStatus: {
          ...node.object.connectionStatus,
          connections: newConnections,
        },
      });
  
      flush();
    },
    [flush]
  );



  // ── Create on are.na + graph ──────────────────────────────────────────────

  const createBlock = useCallback(
    async (data: BlockCreation): Promise<string | null> => {
        if (!fetchOK()) return null;
        const block = await createBlockAPI(data);
        if (!block) return null;

        const blockId = sid(block.id);
        addBlockNode(blockId, undefined, block);

        if (isPending(block)) {
            pollForBlock(blockId);
        }

        return blockId;
    },
    [addBlockNode]
  );

  const pollForBlock = useCallback((blockId: string) => {
      const INTERVAL = 2000;
      const MAX_ATTEMPTS = 15;
      let attempts = 0;
      console.log("POLLING");

      const poll = async () => {
          if (attempts++ >= MAX_ATTEMPTS) return;
          const updated = fetchOK() && await getBlock(blockId);
          if (!updated || isPending(updated)) {
              setTimeout(poll, INTERVAL);
              return;
          }
          graph.current.updateObject(blockId, updated);
          flush();
      };

      setTimeout(poll, INTERVAL);
  }, [flush]);

  const createChannel = useCallback(
    async (
      data: ChannelCreation,
    ): Promise<string | null> => {
      if (!fetchOK()) return null;
      const channel = await createChannelAPI(data);
      if (!channel) return null;

      const channelId = sid(channel.id);
      addChannelNode(channelId, undefined, channel)
      return channelId;
    },
    [addChannelNode]
  );

  // ── Delete from are.na + graph ────────────────────────────────────────────

  const deleteChannel = useCallback(
    async (id: string): Promise<boolean> => {
      if (!fetchOK()) return false;
      const ok = await deleteChannelAPI(sid(id));
      if (!ok) return false;
      purgeNode(sid(id));
      flush();
      return true;
    },
    [purgeNode, flush]
  );

  const hydrateFromAuthUser = useCallback(async (): Promise<AuthUser | null> => {
    const auth = await setUser();
    if (!auth) return null;
  
    const g = graph.current;
  
    const register = (obj: Block | Channel | User | Group) => {
      const id = sid(obj.id);
      const existing = g.get(id);
  
      if (existing) {
        g.updateObject(id, obj);
        return;
      }
  
      g.ensure(id, {
        object: obj,
        onCanvas: false,
        gridPos: { x: 0, y: 0 },
      });
    };
  
    const registerRecursive = (obj: Block | Channel | User | Group) => {
      register(obj);
  
      if (isChannel(obj) || isUser(obj) || isGroup(obj)) {
        for (const child of obj.childrenStatus.children) {
          register(child);
          g.link(sid(obj.id), sid(child.id));
        }
      }
  
      if (isBlock(obj) || isChannel(obj)) {
        for (const conn of obj.connectionStatus.connections) {
          register(conn);
          g.link(sid(conn.id), sid(obj.id));
        }
      }
  
      if (isUser(obj)) {
        for (const item of obj.followingStatus.following) {
          register(item);
        }
        for (const follower of obj.followersStatus.followers) {
          register(follower);
        }
      }
  
      if (isGroup(obj)) {
        for (const follower of obj.followersStatus.followers) {
          register(follower);
        }
      }
    };
    
    addUserNode(auth.user.id, undefined, auth.user);
    registerRecursive(auth.user);
  
    for (const child of auth.user.childrenStatus.children) registerRecursive(child);
    for (const item of auth.user.followingStatus.following) registerRecursive(item);
    for (const follower of auth.user.followersStatus.followers) registerRecursive(follower);
  
    flush();
    return auth;
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
    fetchMoreFollowers,
    fetchMoreFollowing,
    setSelectedNode,
    selectNodeByDirection,
    getNearestNode,
    exportGraph,
    importGraph,
    makeConnection,
    createBlock,
    createChannel,
    deleteChannel,
    hydrateFromAuthUser
  };
}