"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus, ImageBlock, AttachmentBlock, LinkBlock, EmbedBlock, TextBlock } from "@/types/arena";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";
import ImageViewer from "@/components/ui/imageviewer";
import NodeList from "@/components/ui/nodelist";

interface InfoPanelType {
  connectionFetcher: (id: string, s: ConnectionStatus, type: string) => Promise<void>;
  childrenFetcher:   (id: string, s: ChildrenStatus) => Promise<void>;
  makeNodeVisible:   (id: string, body: Block | Channel) => void;
  setSelected:       (id: string) => void;
  checkNodeVisible:  (id: string) => boolean;
  setImageOpen:      (val: boolean) => void;
  closePanel:          () => void;
}

interface InfoPanelProps extends InfoPanelType {
  current: Block | Channel | undefined;
}

const isChannel    = (n: Block | Channel): n is Channel    => n.type === "Channel";
const hasImage     = (n: Block): n is ImageBlock            => "imageUrl" in n;
const isText       = (n: Block): n is TextBlock             => n.type === "Text";
const isAttachment = (n: Block): n is AttachmentBlock       => n.type === "Attachment";
const isEmbed      = (n: Block): n is EmbedBlock            => n.type === "Embed";
const isLink       = (n: Block): n is LinkBlock             => n.type === "Link";

const sectionVariants = {
  open:      { height: "auto", opacity: 1, pointerEvents: "auto"  as const },
  collapsed: { height: 0,      opacity: 0, pointerEvents: "none"  as const },
};
const sectionTransition = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };

function EmbedBlock({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html; }, [html]);
  return <div className="info-media-iframe" ref={ref} />;
}

export default function InfoPanel({
  current, connectionFetcher, childrenFetcher,
  checkNodeVisible, makeNodeVisible, setSelected, setImageOpen,
}: InfoPanelProps) {
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Collapse whenever current disappears
  useEffect(() => { 
    if (!current) setCollapsed(true); 
  }, [current]);
  useEffect(() => { setImageLoaded(false); }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    if (!current.connectionStatus.complete && current.connectionStatus.connections.length === 0)
      connectionFetcher(current.id, current.connectionStatus, isChannel(current) ? "channels" : "blocks");
    if (isChannel(current) && !current.childrenStatus.complete && current.childrenStatus.children.length === 0)
      childrenFetcher(current.id, current.childrenStatus);
  }, [current?.id]);

  const handleViewerOpen = useCallback((val: boolean) => {
    setViewerOpen(val);
    setImageOpen(val);
  }, [setImageOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && current && checkNodeVisible(current.id))
        makeNodeVisible(current.id, current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current]);

  const toggleNode   = (node: Block | Channel) => makeNodeVisible(node.id, node);
  const handleSelect = (node: Block | Channel) =>
    checkNodeVisible(node.id) ? setSelected(node.id) : makeNodeVisible(node.id, node);

  const animState = collapsed ? "collapsed" : "open";

  const block = current as Block | undefined;
  const linkOut = current
    ? isChannel(current)
      ? `https://www.are.na/${current.owner.slug}/${current.id}`
      : ((isLink(current) || isAttachment(current) || isEmbed(current)) ? current.url : `https://www.are.na/block/${current.id}`)
    : "#";

  const hasConnections = !!current && (current.connectionStatus.connections.length > 0 || current.connectionStatus.complete);
  const hasChildren    = !!current && isChannel(current) && current.childrenStatus.children.length > 0;

  return (
    <Panel position="bottom-left" className="info-container">
      <div className="info-box" style={{ pointerEvents: collapsed ? "none" : "auto" }}>
        <div className="info-body">

          {block && !isChannel(current!) && (
            <motion.div
              variants={sectionVariants} animate={animState} initial={false}
              transition={sectionTransition}
              style={{ overflow: "hidden", flexShrink: 0 }}
              className="info-section react-flow__controls"
            >
              {hasImage(block) && !isAttachment(block) && (
                <>
                  {viewerOpen && (
                    <ImageViewer
                      setViewerOpen={handleViewerOpen}
                      title={current!.title ?? current!.id}
                      imageUrl={block.imageUrl}
                      linkOut={linkOut}
                    />
                  )}
                  <motion.div
                    key={current!.id}
                    className="info-media-wrap"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : -8 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleViewerOpen(true)}
                  >
                    <Image src={block.imageUrl} alt={current!.title ?? current!.id} fill
                      onLoad={() => setImageLoaded(true)} className="info-media" />
                  </motion.div>
                </>
              )}
              {isText(block)       && <div className="info-text-content"><HTMLDecode rawHTML={block.content} /></div>}
              {isAttachment(block) && <div className="info-media-iframe"><iframe src={block.url} /></div>}
              {isEmbed(block)      && <EmbedBlock html={block.embed} />}
            </motion.div>
          )}

          {/* Spacer */}
          <motion.div aria-hidden animate={{ flex: collapsed ? 1 : 0 }} initial={false}
            transition={sectionTransition} style={{ minHeight: 0, pointerEvents: "none" }} />

          {/* Meta — always visible */}
          <div className="info-section react-flow__controls info-meta">
            {current ? (
              <>
                <a className="info-title" href={linkOut} target="_blank">
                  {current.title ?? (isChannel(current) ? current.id : "")} ↗
                </a>
                <a className="info-sub" target="_blank" href={`https://www.are.na/${current.owner.slug}`}>
                  {current.owner.name} · {current.date}
                </a>
                <span className="info-id">
                  <a href={(isLink(current) || isAttachment(current) || isEmbed(current))
                    ? `https://are.na/block/${current.id}` : linkOut} target="_blank">
                    {current.id}
                  </a> · {isChannel(current) ? ` Channel · ${current.itemCount} children` : " Block"}
                </span>
              </>
            ) : (
              <>
                <a className="info-title">No node selected.</a>
                <a className="info-sub" style={{ opacity: 0.5 }}>Select or add a node to see details.</a>
              </>
            )}
          </div>

          {/* Connections / children — collapses with details */}
          {(hasChildren || hasConnections) && current && (
            <motion.div
              variants={sectionVariants} animate={animState} initial={false}
              transition={sectionTransition}
              style={{ overflow: "hidden", flex: collapsed ? 0 : "1 1 0", minHeight: 0, padding: collapsed ? 0 : undefined }}
              className="info-section-scroll react-flow__controls"
            >
              <div className="collections-grid">
                {hasChildren && (
                  <NodeList list={current.childrenStatus.children} status={current.childrenStatus}
                    checkNodeVisible={checkNodeVisible} onToggle={toggleNode} onSelect={handleSelect}
                    loadMore={() => childrenFetcher(current.id, current.childrenStatus)}
                    label="Children" nodeId={current.id} />
                )}
                {hasConnections && (
                  <NodeList list={current.connectionStatus.connections} status={current.connectionStatus}
                    checkNodeVisible={checkNodeVisible} onToggle={toggleNode} onSelect={handleSelect}
                    loadMore={() => connectionFetcher(current.id, current.connectionStatus, isChannel(current) ? "channels" : "blocks")}
                    label="Connections" nodeId={current.id} />
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className={current ? "info-toolbar" : "info-toolbar info-null"}>
        <button onClick={() => current && makeNodeVisible(current.id, current)}
          className="node-toolbar-button react-flow__controls popup-menu menu-title">
          <div className="icon-left">{current && `Remove ${isChannel(current) ? "channel" : "block"}`}</div>
          <div className="icon">✕</div>
        </button>
        <button onClick={() => setCollapsed(c => !c)}
          className="node-toolbar-button react-flow__controls popup-menu menu-title">
          <div className="icon-left">{current && (collapsed ? "Show details" : "Hide details")}</div>
          <div className={collapsed ? "icon up" : "icon down"}>▲</div>
        </button>
      </div>
    </Panel>
  );
}