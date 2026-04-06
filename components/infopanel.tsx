"use client";
import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus, ImageBlock, AttachmentBlock, EmbedBlock, TextBlock } from "@/types/arena";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";

interface InfoPanelType {
    connectionFetcher: (id: string, s: ConnectionStatus, type: string) => Promise<void>;
    childrenFetcher: (id: string, s: ChildrenStatus) => Promise<void>;
    makeNodeVisible: (id: string, body: Block | Channel) => void;
    setSelected: (id: string) => void;
    checkNodeVisible: (id: string) => boolean;
  }

interface InfoPanelProps extends InfoPanelType {
    current: Block | Channel;
}

interface InfoPanelPropsNull extends InfoPanelType {
    current: Block | Channel | undefined;
    closePanel: () => void;
}

interface NodeListProps {
    list: (Block | Channel)[];
    status: ConnectionStatus | ChildrenStatus;
    checkNodeVisible: (id: string) => boolean;
    onToggle: (node: Block | Channel) => void;
    onSelect: (node: Block | Channel) => void;
    loadMore: () => void;
    flavorText: string;
    nodeId: string;
}

const isChannel = (n: Block | Channel): n is Channel =>
  n.type === "Channel";

const hasImage = (n: Block): n is ImageBlock =>
  "imageUrl" in n;

const isText = (n: Block): n is TextBlock =>
  n.type === "Text";

const isAttachment = (n: Block): n is AttachmentBlock =>
  n.type === "Attachment";

const isEmbed = (n: Block): n is EmbedBlock =>
  n.type === "Embed";
  
const didAnimate = new Set<string>();

function NodeList({
    list,
    status,
    checkNodeVisible,
    onToggle,
    onSelect,
    loadMore,
    flavorText,
    nodeId
  }: NodeListProps) {
    const animKey = `${nodeId}-${flavorText}`;
    const [hovered, setHovered] = useState<string | null>(null);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        setFetching(false);
    }, [status, list]);

    return (
        <motion.div
            className="half"
            initial={didAnimate.has(animKey) ? false : { opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            transition={{ duration: 0.2 }}
            onAnimationComplete={() => didAnimate.add(animKey)}
            
        >
            <div className="check-header info-subheader">{flavorText}</div>
            <div className="check-header info-subheader">⇣</div>
    
            <div className="list-container">
            {list.map((node) => (
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
                        className="tooltip info-subheader"
                        style={{opacity: node.id == hovered ? 1 : 0,
                        visibility: node.id == hovered ? "visible" : "hidden",
                        right: node.id == hovered ? "1.7em": "5em"
                    }}
                        
                    >
                        {hasImage(node) && 
                            <div className="tooltip-img" style={{backgroundImage: `url(${node.thumbnailUrl})`}}/>
                        }
                        <div className="list-container">
                            <div>{node.title ?? node.id}</div> 
                            <div className="icon">{checkNodeVisible(node.id) ? "⇢" : "+"}</div>
                        </div>
                    </div>
                </div>
            ))}
            {(list.length === 0) && <em>[No connections found]</em>}
            </div>
    
            {!status.complete && (
            <button className= {fetching ? "loader disabled" : "loader"} onClick={() => {
                loadMore();
                setFetching(true);
            }}>
                {fetching ? "Loading..." : "Load more..."}
            </button>
            )}
        </motion.div>
    );
  }

function InfoPanelInner({
    current,
    connectionFetcher,
    childrenFetcher,
    checkNodeVisible,
    makeNodeVisible,
    setSelected,
  }: InfoPanelProps) {
    const [imageLoaded, setImageLoaded] = useState(false);

    useEffect(() => {
        setImageLoaded(false);
    }, [current.id]);
  
    useEffect(() => {
        if (
          !current.connectionStatus.complete &&
          current.connectionStatus.connections.length === 0
        ) {
          connectionFetcher(
            current.id,
            current.connectionStatus,
            isChannel(current) ? "channels" : "blocks"
          );
        }
      
        if (
          isChannel(current) &&
          !current.childrenStatus.complete &&
          current.childrenStatus.children.length === 0
        ) {
          childrenFetcher(current.id, current.childrenStatus);
        }
    }, [current.id]);

    const keyDownEvent = useCallback((e: any) => {
        if (e.key === "Backspace" || e.key === "Delete") {
            if (!current) return;
            console.log(current.id);
            if (checkNodeVisible(current.id)) {
                makeNodeVisible(current.id, current);
            }
        }
    }, [current]);

    useEffect(() => {
        window.addEventListener("keydown", keyDownEvent);
        return () => window.removeEventListener("keydown", keyDownEvent);
    }, [keyDownEvent, current]);
  
    const toggleNode = (node: Block | Channel) => {
      makeNodeVisible(node.id, node);
    };
  
    const handleSelect = (node: Block | Channel) => {
        if (checkNodeVisible(node.id)) {
          setSelected(node.id);
        } else {
          makeNodeVisible(node.id, node);
        }
    };
  
    const linkOut = isChannel(current)
      ? `https://www.are.na/${current.owner.slug}/${current.id}`
      : `https://www.are.na/block/${current.id}`;

    return (
        <div className="info-body">
          {!isChannel(current) && 

            <div>
                {hasImage(current) && !isAttachment(current) && (
                    <motion.div
                            key={current.id}                         
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : -8 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <Image
                                src={current.imageUrl}
                                alt={current.title ?? current.id}
                                fill
                                onLoad={() => setImageLoaded(true)}
                                className="image box"
                                onClick={() => window.open(linkOut)}
                            />
                        </motion.div>
                    )}

                    {isText(current) && (
                    <div className="p-text">
                        <HTMLDecode rawHTML={current.content} />
                    </div>
                    )}

                    {isAttachment(current) && (
                    <div className="p-iframe box">
                        <iframe src={current.url} />
                    </div>
                    )}

                    {isEmbed(current) && (
                    <div
                        className="p-iframe box"
                        dangerouslySetInnerHTML={{ __html: current.embed }}
                    />
                    )}
                </div>
            }
    
          <a className="h info-title" href={linkOut} target="_blank">
            {current.title ?? (isChannel(current) ? current.id : "")} ↗
          </a>
    
          <a className="h info-subheader" target="_blank" href={`https://www.are.na/${current.owner.slug}`}>
            {current.owner.name} • {current.date}
          </a>

          <a className="info-id" href={linkOut} target="_blank">{current.id} • 
            {isChannel(current) ? " Channel" : " Block"}
          </a>
    
          <div className="collections-children">
            {isChannel(current) && current.childrenStatus.children.length > 0 && (
              <NodeList
                list={current.childrenStatus.children}
                status={current.childrenStatus}
                checkNodeVisible={checkNodeVisible}
                onToggle={toggleNode}
                onSelect={handleSelect}
                loadMore={() =>
                  childrenFetcher(current.id, current.childrenStatus)
                }
                flavorText="Children"
                nodeId={current.id}

              />
            )}
    
            {(current.connectionStatus.connections.length > 0 || current.connectionStatus.complete) && <NodeList
                list={current.connectionStatus.connections}
                status={current.connectionStatus}
                checkNodeVisible={checkNodeVisible}
                onToggle={toggleNode}
                onSelect={handleSelect}
                loadMore={() =>
                  connectionFetcher(
                    current.id,
                    current.connectionStatus,
                    isChannel(current) ? "channels" : "blocks"
                  )
                }
                flavorText="Connections"
                nodeId={current.id}
              />}
          </div>
        </div>
      );
    
}

export default function InfoPanel({ 
    current,
    connectionFetcher, 
    childrenFetcher, 
    checkNodeVisible, 
    makeNodeVisible,
    closePanel,
    setSelected
}: InfoPanelPropsNull) {
    
    if (current) return (
        <Panel position="top-right" className="info-container">
            <div className="react-flow__controls info-box">
                <InfoPanelInner 
                    current={current} 
                    connectionFetcher={connectionFetcher}
                    childrenFetcher={childrenFetcher}
                    makeNodeVisible={makeNodeVisible}
                    setSelected={setSelected}
                    checkNodeVisible={checkNodeVisible}
                />
            </div>
            <div className="info-toolbar">
                <button 
                    onClick={() => makeNodeVisible(current.id, current)} 
                    className="node-toolbar-button react-flow__controls popup-menu menu-title"
                >
                    Remove {isChannel(current) ? "channel" : "block"} ✕
                </button>
                <button 
                    onClick={() => closePanel()} 
                    className="node-toolbar-button react-flow__controls popup-menu menu-title"
                >
                    Close ✕
                </button>

            </div>
        </Panel>
    )
}