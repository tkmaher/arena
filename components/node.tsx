"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";
import { motion } from "framer-motion";
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
          border: selected ? `2px solid #1c1c24` : isConnectedToSelected ? `2px dashed #1c1c24` : `2px dashed #1c1c2400`,
          position: "relative",
        }}
      >
        <div className="node-body">
          {"childrenStatus" in data.object ? (
            <>{data.object.title}</>
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
            <HTMLDecode rawHTML={data.object.content} />
          ) : (
            <>{data.object.title}</>
          )}
        </div>
      </div>

      {selected && (
        <div
          style={{
            position: "absolute",
            bottom: "-40px",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "radial-bottom 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
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
        @keyframes radial-bottom {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, 0%) scale(1); }
        }
      `}</style>
    </>
  );
}