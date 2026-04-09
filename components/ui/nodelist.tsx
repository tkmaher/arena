"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Block, Channel, ChildrenStatus, ConnectionStatus, ImageBlock} from "@/types/arena";

interface NodeListProps {
    list:            (Block | Channel)[];
    status:          ConnectionStatus | ChildrenStatus;
    checkNodeVisible:(id: string) => boolean;
    onToggle:        (node: Block | Channel) => void;
    onSelect:        (node: Block | Channel) => void;
    loadMore:        () => void;
    label:           string;
    nodeId:          string;
    limitSize?:      (val: boolean) => void;
}

const hasImage     = (n: Block): n is ImageBlock             => "imageUrl" in n;

const didAnimate = new Set<string>();

export default function NodeList({ list, status, checkNodeVisible, onToggle, onSelect, loadMore, label, nodeId, limitSize }: NodeListProps) {
  const animKey = `${nodeId}-${label}`;
  const [open,     setOpen]     = useState(limitSize ? false : true);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { setFetching(false); }, [status, list]);

  useEffect(() => { 
    if (limitSize) limitSize(open);
  }, [open, limitSize]);

  return (
    <motion.div
      className="collection-col"
      initial={didAnimate.has(animKey) ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onAnimationComplete={() => didAnimate.add(animKey)}
    >
      {/* Collapsible header */}
      <div
        className="collection-header"
        data-open={String(open)}
        onClick={() => setOpen(o => !o)}
      >
        <span className="info-sub">{label} ({list.length}{status.complete ? "" : "+"})</span>
        <span className="collapse-icon">▾</span>
      </div>

      {/* Body collapses via CSS flex transition — no height animation conflict */}
      <div className={`collection-body${open ? "" : " closed"}`}>
        <div className="collection-list">
          {list.length === 0
            ? <em>[No {label.toLowerCase()} found]</em>
            : list.map(node => (
                <div
                  key={node.id}
                  className="checklist"
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <a onClick={() => onSelect(node)}>
                    {node.title ?? node.id}
                  </a>

                  <input
                    type="checkbox"
                    checked={checkNodeVisible(node.id)}
                    onChange={() => onToggle(node)}
                  />

                  <div
                    className="tooltip info-sub"
                    style={{
                      opacity:    node.id === hovered ? 1 : 0,
                      visibility: node.id === hovered ? "visible" : "hidden",
                      right:      node.id === hovered ? "0.8em" : "5em",
                    }}
                  >
                    {hasImage(node as Block) &&
                      <div className="tooltip-img" style={{ backgroundImage: `url(${(node as ImageBlock).thumbnailUrl})` }} />
                    }
                    <div className="list-container">
                      <div className="icon-left">{node.title ?? node.id}</div>
                      <div className="icon">{checkNodeVisible(node.id) ? "⇢" : "+"}</div>
                    </div>
                  </div>
                </div>
              ))
          }
        </div>

        {!status.complete && (
          <button
            className={`loader ${fetching ? "disabled" : ""}`}
            onClick={() => { loadMore(); setFetching(true); }}
          >
            {fetching ? "Loading…" : "Load more…"}
          </button>
        )}
      </div>
    </motion.div>
  );
}