"use client";
import { useState } from "react";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";


import {
    NodeToolbar,
    Position,
    Handle
} from "@xyflow/react";

interface NodeProps {
  id: string;
  data: { object: any; };
  selected: boolean;
}


export default function BlockProp({ id, data, selected }: NodeProps) {
  const { removeNode } = useGraphActions();

    const [imageLoaded, setImageLoaded] = useState(!data.object.thumbnailUrl);
  
    return (
      <>
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
  
        <div className="node-parent" style={{
            border: selected
            ? `0.5px dashed #cfcfcf`
            : `0.5px solid #1c1c24`,
            position: "relative"
        }}>
            <div className="node-body" style={{opacity: imageLoaded ? 1 : 0}}>
              {"childrenStatus" in data.object ?
                <>{data.object.title}</> :
                (data.object.thumbnailUrl ? 
                    <Image
                        src={data.object.thumbnailUrl}
                        alt={data.object.title || "ImageBlock"}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        fill
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

        {selected && (
          <div style={{
            position: "absolute",
            bottom: "-40px",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "radial-bottom 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
            zIndex: 10,
          }}>
            <button
              onClick={() => removeNode(id)}
              className="node-toolbar-button react-flow__controls popup-menu menu-title"
            >
              ✕
            </button>
          </div>
        )}

        <style>{`
              @keyframes radial-bottom {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
                to   { opacity: 1; transform: translate(-50%, 0%) scale(1); }
              }
            `}
        </style>
      </>
    );
  }