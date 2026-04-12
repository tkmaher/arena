"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus, ImageBlock, AttachmentBlock, LinkBlock, EmbedBlock, TextBlock, User, FollowingStatus, FollowersStatus } from "@/types/arena";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";
import ImageViewer from "@/components/ui/imageviewer";
import NodeList from "@/components/ui/nodelist";

interface InfoPanelType {
  connectionFetcher: (id: string, s: ConnectionStatus, type: string) => Promise<void>;
  childrenFetcher:   (id: string, s: ChildrenStatus, isUser: boolean) => Promise<void>;
  followerFetcher:   (id: string, s: FollowersStatus) => Promise<void>;
  followingFetcher:   (id: string, s: FollowingStatus) => Promise<void>;
  makeNodeVisible:   (id: string, body: Block | Channel | User) => void;
  setSelected:       (id: string) => void;
  checkNodeVisible:  (id: string) => boolean;
  setImageOpen:      (val: boolean) => void;
  closePanel:          () => void;
}

interface InfoPanelProps extends InfoPanelType {
  current: Block | Channel | User | undefined;
}

const isChannel    = (n: Block | Channel | User): n is Channel  => n.type === "Channel";
const isUser       = (n: Block | Channel | User): n is User     => n.type === "User";
const hasImage     = (n: Block): n is ImageBlock            => "imageUrl" in n;
const isText       = (n: Block): n is TextBlock             => n.type === "Text";
const isAttachment = (n: Block): n is AttachmentBlock       => n.type === "Attachment";
const isEmbed      = (n: Block): n is EmbedBlock            => n.type === "Embed";
const isLink       = (n: Block): n is LinkBlock             => n.type === "Link";

const sectionVariants = {
  open:      { height: "auto", opacity: 1, pointerEvents: "auto"  as const },
  collapsed: { height: 0,      opacity: 0, pointerEvents: "none"  as const },
};

function EmbedBlockRef({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html; }, [html]);
  return <div className="info-media-iframe" ref={ref} />;
}

function DescriptionRef({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html; }, [html]);
  return <div className="info-sub" ref={ref} />;
}

export default function InfoPanel({
  current, connectionFetcher, childrenFetcher, followerFetcher, followingFetcher,
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
    if (!isUser(current) && !current.connectionStatus.complete && current.connectionStatus.connections.length === 0)
      connectionFetcher(current.id, current.connectionStatus, isChannel(current) ? "channels" : "blocks");
    if ((isChannel(current) || isUser(current)) && !current.childrenStatus.complete && current.childrenStatus.children.length === 0)
      childrenFetcher(current.id, current.childrenStatus, isChannel(current) ? false : true);
    if (isUser(current) && !current.followersStatus.complete && current.followersStatus.followers.length === 0)
      followerFetcher(current.id, current.followersStatus);
    if (isUser(current) && !current.followingStatus.complete && current.followingStatus.following.length === 0)
      followingFetcher(current.id, current.followingStatus);
  }, [current?.id]);

  const handleViewerOpen = useCallback((val: boolean) => {
    setViewerOpen(val);
    setImageOpen(val);
  }, [setImageOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && current && checkNodeVisible(current.id)) {
        makeNodeVisible(current.id, current);
        setSelected("nearest");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current]);

  const toggleNode   = (node: Block | Channel | User) => { makeNodeVisible(node.id, node); }
  const handleSelect = (node: Block | Channel | User) =>
    checkNodeVisible(node.id) ? setSelected(node.id) : makeNodeVisible(node.id, node);

  const animState = collapsed ? "collapsed" : "open";

  const block = current as Block | undefined;
  const linkOut = current
    ? isChannel(current)
      ? `https://www.are.na/${current.owner.slug}/${current.id}`
      : isUser(current) ? `https://www.are.na/${current.slug}`
      : ((isLink(current) || isAttachment(current) || isEmbed(current)) ? current.url : `https://www.are.na/block/${current.id}`)
    : "#";

  const hasConnections = !!current && !isUser(current) && (current.connectionStatus.connections.length > 0 || current.connectionStatus.complete);
  const hasChildren =   !!current && (isChannel(current) || isUser(current)) && (current.childrenStatus.children.length > 0 || current.childrenStatus.complete);
  const hasFollowers   = !!current && isUser(current) && (current.followersStatus.followers.length > 0 || current.followersStatus.complete);
  const hasFollowing   = !!current && isUser(current) && (current.followingStatus.following.length > 0 || current.followingStatus.complete);

  return (
    <Panel position="bottom-left" className="info-container">
      {block && hasImage(block) && !isAttachment(block) && viewerOpen && (
        <ImageViewer
          setViewerOpen={handleViewerOpen}
          title={current!.title ?? current!.id}
          imageUrl={block.imageUrl}
          linkOut={linkOut}
        />
      )}
      <div className="info-box" style={{ pointerEvents: collapsed ? "none" : "auto" }}>
        <div className="info-body">

        {current && !isChannel(current) && (isUser(current) ? !!current.thumbnailUrl : true) && (
          <motion.div
            variants={sectionVariants} animate={animState} initial={false}
            transition={{duration: 0.28, ease: [0.4, 0, 0.2, 1]}}
            style={{ overflow: "hidden", flexShrink: 0 }}
            className="info-section react-flow__controls"
          >
            {isUser(current) && (
              <motion.div key={current.id} className="info-media-wrap"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : -8 }}
                transition={{ duration: 0.3 }}
              >
                <Image src={current.thumbnailUrl!} alt={current.title} fill
                  onLoad={() => setImageLoaded(true)} className="info-media" />
              </motion.div>
            )}
            {!isUser(current) && hasImage(block!) && !isAttachment(block!) && (
              <motion.div key={current.id} className="info-media-wrap"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : -8 }}
                transition={{ duration: 0.3 }} onClick={() => handleViewerOpen(true)}
              >
                <Image src={block!.imageUrl} alt={current.title ?? current.id} fill
                  onLoad={() => setImageLoaded(true)} className="info-media" />
              </motion.div>
            )}
            {!isUser(current) && isText(block!)       && <div className="info-text-content"><HTMLDecode rawHTML={block!.content} /></div>}
            {!isUser(current) && isAttachment(block!) && <div className="info-media-iframe"><iframe src={block!.url} /></div>}
            {!isUser(current) && isEmbed(block!)      && <EmbedBlockRef html={block!.embed} />}
          </motion.div>
        )}

          {/* Spacer */}
          <motion.div aria-hidden animate={{ flex: collapsed ? 1 : 0 }} initial={false}
            transition={{duration: 0.28, ease: [0.4, 0, 0.2, 1]}}
            style={{ minHeight: 0, pointerEvents: "none" }} 
          />

          {/* Meta — always visible */}
          <div className="info-section react-flow__controls info-meta">
            {current ? (
              <>
                <a className="info-title" href={linkOut} target="_blank">
                  {current.title ?? (isChannel(current) ? current.id : "")} ↗
                </a>
                {!isUser(current) && <div className="info-sub">
                  <div className="username" onClick={() => handleSelect(current.owner)}>{current.owner.title} </div>
                  <input
                    type="checkbox"
                    checked={checkNodeVisible(current.owner.id)}
                    onChange={() => makeNodeVisible(current.owner.id, current.owner)}
                  />
                  · {current.date} 
                  
                </div>}
                <span className="info-id">
                  <a href={(isLink(current) || isAttachment(current) || isEmbed(current))
                    ? `https://are.na/block/${current.id}` : linkOut} target="_blank">
                    {current.id}
                  </a> · {isChannel(current) ? ` Channel · ${current.itemCount} children` : isUser(current) ? " User" : " Block"}
                </span>
                {current.description && <DescriptionRef html={current.description} />}
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
              transition={{duration: 0.28, ease: [0.4, 0, 0.2, 1]}}
              style={{ overflow: "hidden", flex: collapsed ? 0 : "1 1 0", minHeight: 0, padding: collapsed ? 0 : undefined }}
              className="info-section-scroll react-flow__controls"
            >
              <div className="collections-grid">
                {hasChildren && (
                  <NodeList list={current.childrenStatus.children} status={current.childrenStatus}
                    checkNodeVisible={checkNodeVisible} onToggle={toggleNode} onSelect={handleSelect}
                    loadMore={() => childrenFetcher(current.id, current.childrenStatus, isChannel(current) ? false : true)}
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
          {(hasFollowers || hasFollowing) && current && (
            <motion.div
              variants={sectionVariants} animate={animState} initial={false}
              transition={{duration: 0.28, ease: [0.4, 0, 0.2, 1]}}
              style={{ overflow: "hidden", flex: collapsed ? 0 : "1 1 0", minHeight: 0, padding: collapsed ? 0 : undefined }}
              className="info-section-scroll react-flow__controls"
            >
              <div className="collections-grid">
                {hasFollowers && (
                  <NodeList list={(current as User).followersStatus.followers} status={(current as User).followersStatus}
                    checkNodeVisible={checkNodeVisible} onToggle={toggleNode} onSelect={handleSelect}
                    loadMore={() => followerFetcher(current.id, (current as User).followersStatus)}
                    label="Followers" nodeId={current.id} />
                )}
                {hasFollowing && (
                  <NodeList list={(current as User).followingStatus.following} status={(current as User).followingStatus}
                    checkNodeVisible={checkNodeVisible} onToggle={toggleNode} onSelect={handleSelect}
                    loadMore={() => followingFetcher(current.id, (current as User).followingStatus)}
                    label="Following" nodeId={current.id} />
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className={current ? "info-toolbar" : "info-toolbar info-null"}>
        <button onClick={() => {
          if (!current) return;
          makeNodeVisible(current.id, current);
          setSelected("nearest");
        }}
          className="node-toolbar-button react-flow__controls popup-menu menu-title">
          <div className="icon-left">{current && `Remove ${isChannel(current) ? "channel" : `${isUser(current) ? "user" : "block"}`}`}</div>
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