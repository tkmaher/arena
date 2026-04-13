import { Node } from "@xyflow/react";
import { Block, Channel, Group, User } from "@/types/arena";


export interface CanvasNodeData extends Record<string, unknown> {
  object: Block | Channel | Group | User;
}

export type CanvasNode = Node<CanvasNodeData>;
  
export interface NodeMeta { onCanvas: boolean; children: string[] }