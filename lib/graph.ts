import { Edge, MarkerType, useReactFlow } from "@xyflow/react";
import type { Block, Channel } from "@/types/arena";
import type { CanvasNode } from "@/types/reactflow";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GRID_SIZE = 250;
export const INITIAL_CANVAS_LIMIT = 8; // max siblings shown on first load

// ─── PositionAllocator ────────────────────────────────────────────────────────

/**
 * Hands out {x,y} grid coordinates in a BFS spiral, and reclaims them when
 * nodes are removed.  All membership checks are O(1) via Sets.
 */
export class PositionAllocator {
  private occupied = new Set<string>();
  private queue: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  private inQueue = new Set<string>(["0,0"]);

  private static key(x: number, y: number) {
    return `${x},${y}`;
  }

  allocate(near?: { x: number; y: number }): { x: number; y: number } {
    // pick the queued position closest to `near`, or just shift() if no hint
    while (near && this.queue.length > 0) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < this.queue.length; i++) {
        const p = this.queue[i];
        const d = ((p.x * GRID_SIZE) - near.x) ** 2 + ((p.y * GRID_SIZE) - near.y) ** 2;
        if (d < bestDist) { bestDist = d; best = i; }
      }
      const [pos] = this.queue.splice(best, 1);
      const k = PositionAllocator.key(pos.x, pos.y);
      this.inQueue.delete(k);

      if (this.occupied.has(k)) continue; // race: already taken, skip
      this.occupied.add(k);

      // Enqueue all unvisited neighbours
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = pos.x + dx;
          const ny = pos.y + dy;
          const nk = PositionAllocator.key(nx, ny);
          if (!this.occupied.has(nk) && !this.inQueue.has(nk)) {
            this.inQueue.add(nk);
            this.queue.push({ x: nx, y: ny });
          }
        }
      }

      return pos;
    }
    // Theoretically unreachable — the queue grows unboundedly
    return { x: 0, y: 0 };
  }

  release(x: number, y: number): void {
    const k = PositionAllocator.key(x, y);
    if (!this.occupied.has(k)) return;
    this.occupied.delete(k);
    // Reclaim before newly-queued spots so freed positions are reused quickly
    if (!this.inQueue.has(k)) {
      this.inQueue.add(k);
      this.queue.unshift({ x, y });
    }
  }
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface GraphNodeData {
    object: Block | Channel;
    gridPos: { x: number; y: number };
    /** Set on first drag; overrides gridPos in toReactFlowNodes. */
    manualPos?: { x: number; y: number };
    onCanvas: boolean;
    children: Set<string>;
    parents: Set<string>;
}

export class Graph {
  private nodes = new Map<string, GraphNodeData>();

  // ── Read ────────────────────────────────────────────────────────────────────

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  get(id: string): GraphNodeData | undefined {
    return this.nodes.get(id);
  }

  isOnCanvas(id: string): boolean {
    return this.nodes.get(id)?.onCanvas ?? false;
  }

  // ── Write ───────────────────────────────────────────────────────────────────

  /**
   * Insert a node (or update an existing one).
   * Only the fields present in `data` are written; missing fields are left as-is
   * on existing nodes, or initialised to sensible defaults on new ones.
   */
  ensure(
    id: string,
    data: Partial<Pick<GraphNodeData, "object" | "gridPos" | "onCanvas">> = {}
  ): GraphNodeData {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        object: data.object as Block | Channel,
        gridPos: data.gridPos ?? { x: 0, y: 0 },
        onCanvas: data.onCanvas ?? false,
        children: new Set(),
        parents: new Set(),
      });
    } else {
      const n = this.nodes.get(id)!;
      if (data.object  !== undefined) n.object  = data.object;
      if (data.gridPos !== undefined) n.gridPos = data.gridPos;
      if (data.onCanvas !== undefined) n.onCanvas = data.onCanvas;
    }
    return this.nodes.get(id)!;
  }

  /** Add a directed edge parent → child. Creates stub nodes if needed. */
  link(parentId: string, childId: string): void {
    const p = this.ensure(parentId);
    const c = this.ensure(childId);
    p.children.add(childId);
    c.parents.add(parentId);
  }

  /** Remove a directed edge. Does NOT remove nodes. */
  unlink(parentId: string, childId: string): void {
    this.nodes.get(parentId)?.children.delete(childId);
    this.nodes.get(childId)?.parents.delete(parentId);
  }

  setOnCanvas(id: string, value: boolean): void {
    const n = this.nodes.get(id);
    if (n) n.onCanvas = value;
  }

  // ── Derivations ─────────────────────────────────────────────────────────────

  /** All node IDs currently on the canvas. */
  canvasIds(): Set<string> {
    const s = new Set<string>();
    for (const [id, n] of this.nodes) {
      if (n.onCanvas) s.add(id);
    }
    return s;
  }

  /**
   * ReactFlow node array derived from canvas state.
   * Cheap to call — only iterates once over the map.
   */
  toReactFlowNodes(): CanvasNode[] {
    const out: CanvasNode[] = [];
    for (const [id, n] of this.nodes) {
      if (!n.onCanvas || !n.object) continue;
      out.push({
        id,
        type: "Canvas",
        position: n.manualPos ?? {
            x: n.gridPos.x * GRID_SIZE,
            y: n.gridPos.y * GRID_SIZE,
        },
        style: { width: GRID_SIZE * 0.75, height: GRID_SIZE * 0.75 },
        data: { object: n.object },
      });
    }
    return out;
  }

  /**
   * ReactFlow edge array: one entry per on-canvas parent→child pair.
   * De-duplicated by construction (Set iteration is unique).
   */
  toReactFlowEdges(): Edge[] {
    const out: Edge[] = [];
    for (const [id, n] of this.nodes) {
      if (!n.onCanvas) continue;
      for (const childId of n.children) {
        if (this.nodes.get(childId)?.onCanvas) {
          out.push({
            id: `${id}->${childId}`,
            source: id,
            target: childId,
            type: "floating",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#000" },
          });
        }
      }
    }
    return out;
  }

  /**
   * Update a node's `object` field in-place (e.g. after fetching paginated
   * connections/children).  Returns false if the node does not exist.
   */
  updateObject(id: string, object: Block | Channel): boolean {
    const n = this.nodes.get(id);
    if (!n) return false;
    n.object = object;
    return true;
  }
}