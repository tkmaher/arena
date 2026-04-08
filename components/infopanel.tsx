"use client";
import { useEffect, useState, useCallback, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus, ImageBlock, AttachmentBlock, LinkBlock, EmbedBlock, TextBlock } from "@/types/arena";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";
import ImageViewer from "@/components/imageviewer";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InfoPanelType {
  connectionFetcher: (id: string, s: ConnectionStatus, type: string) => Promise<void>;
  childrenFetcher:   (id: string, s: ChildrenStatus) => Promise<void>;
  makeNodeVisible:   (id: string, body: Block | Channel) => void;
  setSelected:       (id: string) => void;
  checkNodeVisible:  (id: string) => boolean;
  setImageOpen:      (val: boolean) => void;
}

interface InfoPanelProps      extends InfoPanelType { current: Block | Channel; collapsed: boolean; }
interface InfoPanelPropsNull  extends InfoPanelType { current: Block | Channel | undefined; closePanel: () => void; }

interface NodeListProps {
  list:            (Block | Channel)[];
  status:          ConnectionStatus | ChildrenStatus;
  checkNodeVisible:(id: string) => boolean;
  onToggle:        (node: Block | Channel) => void;
  onSelect:        (node: Block | Channel) => void;
  loadMore:        () => void;
  label:           string;
  nodeId:          string;
}

// ─── Type guards ─────────────────────────────────────────────────────────────

const isChannel    = (n: Block | Channel): n is Channel     => n.type === "Channel";
const hasImage     = (n: Block): n is ImageBlock             => "imageUrl" in n;
const isText       = (n: Block): n is TextBlock              => n.type === "Text";
const isAttachment = (n: Block): n is AttachmentBlock        => n.type === "Attachment";
const isEmbed      = (n: Block): n is EmbedBlock             => n.type === "Embed";
const isLink       = (n: Block): n is LinkBlock             => n.type === "Link";

// ─── Collapsible section wrapper ─────────────────────────────────────────────
//
// Animates height to/from 0. `overflow: hidden` is baked in so content clips
// cleanly during the transition.  framer-motion resolves "auto" by measuring
// the DOM height before animating, so the open→collapse direction is smooth too.

const sectionVariants = {
  open:      { height: "auto", opacity: 1, pointerEvents: "auto"  as const },
  collapsed: { height: 0,      opacity: 0, pointerEvents: "none"  as const },
};

const sectionTransition = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };

// ─── Collapsible scrollable column ───────────────────────────────────────────

const didAnimate = new Set<string>();

function NodeList({ list, status, checkNodeVisible, onToggle, onSelect, loadMore, label, nodeId }: NodeListProps) {
  const animKey = `${nodeId}-${label}`;
  const [open,     setOpen]     = useState(true);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { setFetching(false); }, [status, list]);

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
                      <div>{node.title ?? node.id}</div>
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

// ─── Inner panel ─────────────────────────────────────────────────────────────

function InfoPanelInner({ current, connectionFetcher, childrenFetcher, checkNodeVisible, makeNodeVisible, setSelected, collapsed, setImageOpen }: InfoPanelProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => { setImageLoaded(false); }, [current.id]);

  const handleViewerOpen = useCallback((val: boolean) => {
    setViewerOpen(val);
    setImageOpen(val);
  }, [setImageOpen]);

  useEffect(() => {
    if (!current.connectionStatus.complete && current.connectionStatus.connections.length === 0)
      connectionFetcher(current.id, current.connectionStatus, isChannel(current) ? "channels" : "blocks");

    if (isChannel(current) && !current.childrenStatus.complete && current.childrenStatus.children.length === 0)
      childrenFetcher(current.id, current.childrenStatus);
  }, [current.id]);

  const keyDownEvent = useCallback((e: KeyboardEvent) => {
    if ((e.key === "Backspace" || e.key === "Delete") && checkNodeVisible(current.id))
      makeNodeVisible(current.id, current);
  }, [current]);

  useEffect(() => {
    window.addEventListener("keydown", keyDownEvent);
    return () => window.removeEventListener("keydown", keyDownEvent);
  }, [keyDownEvent]);

  const toggleNode    = (node: Block | Channel) => makeNodeVisible(node.id, node);
  const handleSelect  = (node: Block | Channel) =>
    checkNodeVisible(node.id) ? setSelected(node.id) : makeNodeVisible(node.id, node);

  const linkOut = isChannel(current)
    ? `https://www.are.na/${current.owner.slug}/${current.id}`
    : ((isLink(current) || isAttachment(current) || isEmbed(current)) ? `${current.url}` : `https://www.are.na/block/${current.id}`);

  const block          = current as Block;
  const hasConnections = current.connectionStatus.connections.length > 0 || current.connectionStatus.complete;
  const hasChildren    = isChannel(current) && current.childrenStatus.children.length > 0;
  const animState      = collapsed ? "collapsed" : "open";

  return (
    <div className="info-body">
      {hasImage(block) && !isAttachment(block) && viewerOpen && (
        <ImageViewer 
          setViewerOpen={handleViewerOpen}
          title={current.title ?? current.id}
          imageUrl={block.imageUrl}
          linkOut={linkOut}
        />
      )}

      {/* ── Media section — shrinks to nothing when collapsed ── */}
      {!isChannel(current) && (
        <motion.div
          variants={sectionVariants}
          animate={animState}
          initial={false}
          transition={sectionTransition}
          style={{ overflow: "hidden", flexShrink: 0 }}
          className="info-section react-flow__controls"
        >
            {hasImage(block) && !isAttachment(block) && (
              <motion.div
                key={current.id}
                className="info-media-wrap"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : -8 }}
                transition={{ duration: 0.3 }}
                onClick={() => handleViewerOpen(true)} 
              >
                <Image
                  src={block.imageUrl}
                  alt={current.title ?? current.id}
                  fill
                  onLoad={() => setImageLoaded(true)}
                  className="info-media"
                />
              </motion.div>
            )}

            {isText(block) && (
              <div className="info-text-content">
                <HTMLDecode rawHTML={block.content} />
              </div>
            )}

            {isAttachment(block) && (
              <div className="info-media-iframe">
                <iframe src={block.url} />
              </div>
            )}

            {isEmbed(block) && (
              <div className="info-media-iframe" dangerouslySetInnerHTML={{ __html: block.embed }} />
            )}
        </motion.div>
      )}

      {/* ── Spacer — inflates to push meta down when collapsed ── */}
      <motion.div
        aria-hidden
        animate={{ flex: collapsed ? 1 : 0 }}
        initial={false}
        transition={sectionTransition}
        style={{ minHeight: 0, pointerEvents: "none" }}
      />

      {/* ── Meta section — always visible, slides down on collapse ── */}
      <div className="info-section react-flow__controls info-meta">
        <a className="info-title" href={linkOut} target="_blank">
          {current.title ?? (isChannel(current) ? current.id : "")} ↗
        </a>
        <a className="info-sub" target="_blank" href={`https://www.are.na/${current.owner.slug}`}>
          {current.owner.name} · {current.date}
        </a>
        <span className="info-id">
          <a 
            href={(isLink(current) || 
              isAttachment(current) || 
              isEmbed(current)) ? 
              `https://are.na/block/${current.id}` : 
              linkOut} 
            target="_blank"
          >
            {current.id}
          </a> · 
          {isChannel(current) ? "Channel" : "Block"}
        </span>
      </div>

      {/* ── Collections section — shrinks to nothing when collapsed ── */}
      {(hasChildren || hasConnections) && (
        <motion.div
          variants={sectionVariants}
          animate={animState}
          initial={false}
          transition={sectionTransition}
          style={{ overflow: "hidden", flex: collapsed ? 0 : "1 1 0", minHeight: 0, padding: collapsed ? 0 : undefined }}
          className="info-section-scroll react-flow__controls"
        >
            <div className="collections-grid">
              {hasChildren && (
                <NodeList
                  list={current.childrenStatus.children}
                  status={current.childrenStatus}
                  checkNodeVisible={checkNodeVisible}
                  onToggle={toggleNode}
                  onSelect={handleSelect}
                  loadMore={() => childrenFetcher(current.id, current.childrenStatus)}
                  label="Children"
                  nodeId={current.id}
                />
              )}
              {hasConnections && (
                <NodeList
                  list={current.connectionStatus.connections}
                  status={current.connectionStatus}
                  checkNodeVisible={checkNodeVisible}
                  onToggle={toggleNode}
                  onSelect={handleSelect}
                  loadMore={() =>
                    connectionFetcher(current.id, current.connectionStatus, isChannel(current) ? "channels" : "blocks")
                  }
                  label="Connections"
                  nodeId={current.id}
                />
              )}
            </div>
        </motion.div>
      )}
    </div>
  );
}

function InfoPanelNull() {

  return (
    <div className="info-body">
      <motion.div
        aria-hidden
        animate={{ flex: 1 }}
        initial={false}
        transition={sectionTransition}
        style={{ minHeight: 0, pointerEvents: "none" }}
      />
      <div className="info-section react-flow__controls info-meta">
        <a className="info-title">
          [No node selected]
        </a>
        <a className="info-sub" style={{opacity: 0.5}}>
          Select a node to see details
        </a>

      </div>
    </div>
  );
}

// ─── Exported panel ──────────────────────────────────────────────────────────

export default function InfoPanel({
  current, connectionFetcher, childrenFetcher,
  checkNodeVisible, makeNodeVisible, setSelected,
  setImageOpen
}: InfoPanelPropsNull) {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  return (
    <Panel position="bottom-left" className="info-container">
      <div className="info-box" style={{pointerEvents: (collapsed || current === undefined) ? "none" : "auto"}}>
        {(current != null) ? <InfoPanelInner
          current={current}
          connectionFetcher={connectionFetcher}
          childrenFetcher={childrenFetcher}
          makeNodeVisible={makeNodeVisible}
          setSelected={setSelected}
          checkNodeVisible={checkNodeVisible}
          collapsed={collapsed}
          setImageOpen={setImageOpen}
        /> : <InfoPanelNull/>}
      </div>

      <div className={current ? "info-toolbar" : "info-toolbar info-null"}>
        <button
          onClick={() => {if (current) makeNodeVisible(current.id, current)}}
          className="node-toolbar-button react-flow__controls popup-menu menu-title"
        >
          {current ? `Remove ${isChannel(current) ? "channel" : "block"}` : "No node selected"} <div className="icon">✕</div>
        </button>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="node-toolbar-button react-flow__controls popup-menu menu-title"
        >
          {collapsed ? "Expand" : "Collapse"} <div className="icon">{collapsed ? "▴" : "✕"}</div>
        </button>
      </div>
    </Panel>
  );
}