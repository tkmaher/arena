"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Block, Channel, User, ChildrenStatus, ConnectionStatus, FollowersStatus, FollowingStatus, ImageBlock, Group } from "@/types/arena";
import { isBlock, isChannel, isGroup, isUser } from "@/scripts/utility";

type AnyNode = Block | Channel | User | Group;
type AnyStatus = ConnectionStatus | ChildrenStatus | FollowersStatus | FollowingStatus;

interface NodeListProps {
    list:             AnyNode[];
    status:           AnyStatus;
    checkNodeVisible: (id: string) => boolean;
    onToggle:         (node: AnyNode) => void;
    onSelect:         (node: AnyNode) => void;
    loadMore:         () => void;
    label:            string;
    nodeId:           string;
    limitSize?:       (val: boolean) => void;
}

const hasImage = (n: AnyNode): n is ImageBlock => "imageUrl" in n && n.type !== "User";

const didAnimate = new Set<string>();

export default function NodeList({ list, status, checkNodeVisible, onToggle, onSelect, loadMore, label, nodeId, limitSize }: NodeListProps) {
  const animKey = `${nodeId}-${label}`;
  const [open,     setOpen]     = useState(limitSize ? false : true);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { setFetching(false); }, [status, list]);
  useEffect(() => { if (limitSize) limitSize(open); }, [open, limitSize]);

  const isComplete = "complete" in status ? status.complete : true;

  const filtered = list.filter(ch => {
    return (ch.title ?? ch.id.toString()).toLowerCase().includes(search.toLowerCase());
  });
  

  return (
    <motion.div
      className="collection-col"
      initial={didAnimate.has(animKey) ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onAnimationComplete={() => didAnimate.add(animKey)}
    >
      <div
        className="collection-header"
        data-open={String(open)}
        onClick={() => setOpen(o => !o)}
      >
        <span className="info-sub">{label} ({list.length}{isComplete ? "" : "+"})</span>
        <span className="collapse-icon">▾</span>
      </div>

      <div className={`collection-body${open ? "" : " closed"}`}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}...`}
          className="text-input"
        />
        <div className="collection-list">
          {filtered.length === 0
            ? <em>[No {label.toLowerCase()} found]</em>
            : filtered.map(node => (
                <div
                  key={node.id}
                  className="checklist"
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <a onClick={() => onSelect(node)}>
                    <img src={
                      isBlock(node) ? "block.svg" : isChannel(node) ? "channel.svg" : isGroup(node) ? "group.svg" : "user.svg"}
                    />
                    <div>{node.title ?? node.id}</div>
                  </a>

                  {!limitSize && (
                    <input
                      type="checkbox"
                      checked={checkNodeVisible(node.id)}
                      onChange={() => onToggle(node)}
                    />
                  )}

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
                      <div className="icon-left ellipse">{node.title ?? node.id}</div>
                      <div className="icon">{checkNodeVisible(node.id) ? "⇢" : "+"}</div>
                    </div>
                  </div>
                </div>
              ))
          }
        </div>

        {!isComplete && (
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