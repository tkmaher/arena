"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";

import {
    useReactFlow,
    NodeToolbar,
    Position,
    Handle
} from "@xyflow/react";

export default function BlockProp({ id, data, selected }: {id: string, data: any, selected: boolean}) {
    const { setNodes } = useReactFlow();
  
    const deleteNode = useCallback(() => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
    }, [id, setNodes]);

    const [imageLoaded, setImageLoaded] = useState(!data.object.thumbnailUrl);
  
    return (
      <>
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        {/* NodeToolbar — floats above the node when selected */}
        <NodeToolbar style={{
                opacity: selected ? "100%" : "0%"
            }} 
            position={Position.Bottom} 
            align="center"
        >
          <button
            onClick={deleteNode}
            className="node-toolbar-button react-flow__controls popup-menu menu-title"
          >
            ✕
          </button>
        </NodeToolbar>
        <NodeToolbar style={{
                opacity: selected ? "100%" : "0%"
            }} 
            position={Position.Top} 
            align="center"
        >
          <button
            className="node-toolbar-button react-flow__controls popup-menu menu-title"
          >
            ?
          </button>
        </NodeToolbar>
  
        <div className="node-parent" style={{
            border: selected
            ? `0.5px dashed #cfcfcf`
            : `0.5px solid #1c1c24`
        }}>
            <div className="node-body" style={{opacity: imageLoaded ? 1 : 0}}>
              {"childrenStatus" in data.object ?
                <>{data.object.title}</> :
                (data.object.thumbnailUrl ? 
                    <Image
                        src={data.object.thumbnailUrl}
                        alt={data.object.title || "ImageBlock"}
                        fill
                        objectFit="cover"
                        style={{opacity: imageLoaded ? 1 : 0}}
                        onLoad={() => setImageLoaded(true)}
                        placeholder="empty"
                        className="image"
                    /> : (data.object.content ? 
                        <HTMLDecode rawHTML={data.object.content}/> :
                        <>{data.object.title}</>
                    )
                  )
              }
            </div>
        </div>
      </>
    );
  }