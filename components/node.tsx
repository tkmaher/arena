"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";
import { Position, Handle, useStore } from "@xyflow/react";

interface NodeProps {
  id: string;
  data: { object: any };
  selected: boolean;
}

export default function BlockProp({ id, data, selected }: NodeProps) {
  const { removeNode, selectedOnGraph } = useGraphActions();
  const [imageLoaded, setImageLoaded] = useState(!data.object.thumbnailUrl);

  const handleRemove = () => removeNode(id);

  const isSelected = selectedOnGraph === id;

  const edges = useStore((state) => state.edges);

  const isConnectedToSelected = useMemo(() => {
    if (!selectedOnGraph) return false;
    return edges.some(
      (edge) =>
        (edge.source === id && edge.target === selectedOnGraph) ||
        (edge.target === id && edge.source === selectedOnGraph)
    );
  }, [edges, id, selectedOnGraph]);

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div
        className="node-parent"
        style={{
          border: isSelected ? `0.5px solid #1f1f1f` : isConnectedToSelected ? `0.5px dashed #1f1f1f` : `0.5px dashed #1f1f1f00`,
          position: "relative",
        }}
      >
        <div className="node-body">
          {"childrenStatus" in data.object ? (
              <div className="node-title"><div>{data.object.title}</div>
                {data.object.type == "User" && <img src="user.svg" alt="User"/>}
                {data.object.type == "Group" && <img src="group.svg"  alt="Group"/>}
                {data.object.type == "Channel" && <img src="channel.svg"  alt="Channel"/>}
              </div>
          ) : data.object.thumbnailUrl ? (
            <Image
              src={data.object.thumbnailUrl} 
              alt={data.object.title || "ImageBlock"}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              fill
              style={{opacity: imageLoaded ? 1 : 0}}
              onLoad={() => setImageLoaded(true)}
              placeholder="empty"
              className="image"
            />
          ) : data.object.content ? (
            <div><HTMLDecode rawHTML={data.object.content} /></div>
          ) : (
            <div>{data.object.title}</div>
          )}
        </div>
      </div>

      {isSelected && (
        <div
          style={{
            position: "absolute",
            bottom: "-40px",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "radial-x 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
            zIndex: 10,
          }}
        >
          <button
            onClick={handleRemove}
            className="node-toolbar-button react-flow__controls popup-menu menu-title"
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes radial-x {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, 0%) scale(1); }
        }
      `}</style>
    </>
  );
}