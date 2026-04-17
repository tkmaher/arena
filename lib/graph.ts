import { Edge, MarkerType } from "@xyflow/react";
import type { Block, Channel, Group, User } from "@/types/arena";
import type { CanvasNode } from "@/types/reactflow";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GRID_SIZE = 250;
export const INITIAL_CANVAS_LIMIT = 8;

// ─── PositionAllocator ────────────────────────────────────────────────────────

export class PositionAllocator {
  private occupied = new Set<string>();
  private queue: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  private inQueue = new Set<string>(["0,0"]);

  private static key(x: number, y: number) {
    return `${x},${y}`;
  }

  findNearestFree(
    start: { x: number; y: number },
    occupied: Set<string>
  ): { x: number; y: number } {
    const visited = new Set<string>();
    const queue = [start];

    while (queue.length > 0) {
      const p = queue.shift()!;
      const k = PositionAllocator.key(p.x, p.y);
      if (!occupied.has(k)) return p;
      if (visited.has(k)) continue;
      visited.add(k);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          queue.push({ x: p.x + dx, y: p.y + dy });
        }
      }
    }

    return start;
  }

  allocate(near?: { x: number; y: number }): { x: number; y: number } {
    while (this.queue.length > 0) {
      let best = 0;
      let bestDist = Infinity;

      if (near) {
        for (let i = 0; i < this.queue.length; i++) {
          const p = this.queue[i];
          const d =
            ((p.x * GRID_SIZE) - near.x) ** 2 +
            ((p.y * GRID_SIZE) - near.y) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        }
      }

      const [bestPos] = this.queue.splice(best, 1);
      const bestKey = PositionAllocator.key(bestPos.x, bestPos.y);
      this.inQueue.delete(bestKey);

      let pos = bestPos;

      if (near) {
        const maxDist = (4 * GRID_SIZE) ** 2;
        if (bestDist > maxDist) {
          const snapped = {
            x: Math.round(near.x / GRID_SIZE),
            y: Math.round(near.y / GRID_SIZE),
          };
          pos = this.findNearestFree(snapped, this.occupied);
        }
      }

      const k = PositionAllocator.key(pos.x, pos.y);
      if (this.occupied.has(k)) continue;
      this.occupied.add(k);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = bestPos.x + dx;
          const ny = bestPos.y + dy;
          const nk = PositionAllocator.key(nx, ny);
          if (!this.occupied.has(nk) && !this.inQueue.has(nk)) {
            this.inQueue.add(nk);
            this.queue.push({ x: nx, y: ny });
          }
        }
      }

      return pos;
    }

    return { x: 0, y: 0 };
  }

  release(x: number, y: number): void {
    const k = PositionAllocator.key(x, y);
    if (!this.occupied.has(k)) return;
    this.occupied.delete(k);
    if (!this.inQueue.has(k)) {
      this.inQueue.add(k);
      this.queue.unshift({ x, y });
    }
  }

  occupy(x: number, y: number): void {
    const k = PositionAllocator.key(x, y);
    if (this.occupied.has(k)) return;
    this.occupied.add(k);
    const idx = this.queue.findIndex(p => p.x === x && p.y === y);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      this.inQueue.delete(k);
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        const nk = PositionAllocator.key(nx, ny);
        if (!this.occupied.has(nk) && !this.inQueue.has(nk)) {
          this.inQueue.add(nk);
          this.queue.push({ x: nx, y: ny });
        }
      }
    }
  }
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface GraphNodeData {
  object: Block | Channel | User | Group;
  gridPos: { x: number; y: number };
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

  ensure(
    id: string,
    data: Partial<Pick<GraphNodeData, "object" | "gridPos" | "onCanvas">> = {}
  ): GraphNodeData {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        object:   data.object as (Block | Channel | User | Group),
        gridPos:  data.gridPos  ?? { x: 0, y: 0 },
        onCanvas: data.onCanvas ?? false,
        children: new Set(),
        parents:  new Set(),
      });
    } else {
      const n = this.nodes.get(id)!;
      if (data.object   !== undefined) n.object   = data.object;
      if (data.gridPos  !== undefined) n.gridPos  = data.gridPos;
      if (data.onCanvas !== undefined) n.onCanvas = data.onCanvas;
    }
    return this.nodes.get(id)!;
  }

  link(parentId: string | number, childId: string | number): void {
    const p = this.ensure(String(parentId));
    const c = this.ensure(String(childId));
    p.children.add(String(childId));
    c.parents.add(String(parentId));
  }

  unlink(parentId: string, childId: string): void {
    this.nodes.get(parentId)?.children.delete(childId);
    this.nodes.get(childId)?.parents.delete(parentId);
  }

  /**
   * Fully remove a node and all edges that touch it.
   * Safe to call on nodes that are still on-canvas — the caller must release
   * the grid position via PositionAllocator before or after calling this.
   */
  remove(id: string): void {
    const n = this.nodes.get(id);
    if (!n) return;
    // Detach from every parent and child before deleting
    for (const parentId of n.parents)   this.nodes.get(parentId)?.children.delete(id);
    for (const childId  of n.children)  this.nodes.get(childId)?.parents.delete(id);
    this.nodes.delete(id);
  }

  setOnCanvas(id: string, value: boolean): void {
    const n = this.nodes.get(id);
    if (n) n.onCanvas = value;
  }

  // ── Derivations ─────────────────────────────────────────────────────────────

  canvasIds(): Set<string> {
    const s = new Set<string>();
    for (const [id, n] of this.nodes) {
      if (n.onCanvas) s.add(id);
    }
    return s;
  }

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

  updateObject(id: string, object: Block | Channel | User | Group): boolean {
    const n = this.nodes.get(id);
    if (!n) return false;
    n.object = object;
    return true;
  }

  exportGraph() {
    const nodes = [];
    for (const [id, n] of this.nodes) {
      nodes.push({
        id,
        object:   n.object,
        gridPos:  n.gridPos,
        onCanvas: n.onCanvas,
        children: Array.from(n.children),
        parents:  Array.from(n.parents),
      });
    }

    const jsonString = JSON.stringify(nodes, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const now = new Date();
    const formatted = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    const filename = `arena-flow-archive-${formatted}.json`;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  importGraph(nodes: any) {
    for (const n of nodes) {
      this.nodes.set(n.id, {
        object:   n.object,
        gridPos:  n.gridPos,
        onCanvas: n.onCanvas,
        children: new Set(n.children),
        parents:  new Set(n.parents),
      });
    }
  }
}