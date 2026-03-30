import { Node } from "@xyflow/react";
import { Block, Channel } from "@/types/arena";


export interface CanvasNodeData extends Record<string, unknown> {
    object: Block | Channel;
  }
export type CanvasNode = Node<CanvasNodeData>;
  
export interface NodeMeta { onCanvas: boolean; children: string[] }