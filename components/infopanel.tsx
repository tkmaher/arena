"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus } from "@/types/arena";
import Image from "next/image";
import { HTMLDecode } from "@/scripts/utility";

interface InfoPanelType {
    connectionFetcher: (id: string, s: ConnectionStatus, type: string) => Promise<void>;
    childrenFetcher: (id: string, s: ChildrenStatus) => Promise<void>;
    checkNodeVisible: (id: string) => boolean;
    makeNodeVisible: (id: string, body: Block | Channel) => void;
  }

interface InfoPanelProps extends InfoPanelType {
    current: Block | Channel;
}

interface InfoPanelPropsNull extends InfoPanelType {
    current: Block | Channel | undefined;
    closePanel: () => void;
}

function InfoPanelInner({ current, connectionFetcher, childrenFetcher, checkNodeVisible, makeNodeVisible }: InfoPanelProps) {
    const [imageLoaded, setImageLoaded] = useState(current.hasOwnProperty("thumbnailUrl") ? false : true);

    const visibleIds = useMemo(() => {
        const ids = current.connectionStatus.connections.map(c => c.id.toString());
        if (current.type === "Channel") {
          ids.push(...current.childrenStatus.children.map(c => c.id.toString()));
        }
        return new Set(ids.filter(checkNodeVisible));
    }, [
        current.connectionStatus.connections,
        current.type === "Channel" ? current.childrenStatus.children : null,
        checkNodeVisible
    ]);

    useEffect(() => {
        if (!current) return;
      
        if (!current.connectionStatus.complete && 
            current.connectionStatus.connections.length == 0) {
          connectionFetcher(
            current.id,
            current.connectionStatus,
            current.type === "Channel" ? "channels" : "blocks"
          );
        }
      
        if (current.type === "Channel" && 
            !current.childrenStatus.complete &&
            current.childrenStatus.children.length == 0) {
            childrenFetcher(current.id, current.childrenStatus);
        }
    }, [
        current.id,
        current.connectionStatus.page,
        current.connectionStatus.complete,
        current.type === "Channel" ? current.childrenStatus.page : null,
        current.type === "Channel" ? current.childrenStatus.complete : null
    ]);

    useEffect(() => {
        setImageLoaded(current.hasOwnProperty("thumbnailUrl") ? false : true);
    }, [current.id]);        
    
    function BlockDisplay() {
        return (
            <>
                {(current.hasOwnProperty("imageUrl") && current.type != "Attachment") && 
                    <Image
                        src={current.imageUrl}
                        alt={current.title || current.id}
                        fill
                        style={{opacity: imageLoaded ? 1 : 0}}
                        onLoad={() => setImageLoaded(true)}
                        placeholder="empty"
                        className="image"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        onClick={() => {
                            if (current.hasOwnProperty("url")) {
                                window.open(current.url
                                , "_blank");
                            } else {
                                window.open(`https://www.are.na/block/${current.id}`
                                , "_blank")};
                            } 
                        }
                    />
                }
                {current.type === "Text" &&
                    <div className="p-text">
                        <HTMLDecode rawHTML={current.content}/>
                    </div>
                }
                {current.type == "Attachment" &&
                    <div className="p-iframe" >
                        <iframe src={current.url}/>
                    </div>
                }
                
                {current.type == "Embed" &&
                    <div 
                        className="p-iframe" 
                        dangerouslySetInnerHTML={{__html: current.embed}}
                    />
                }
            </>
        );
    }

    function UserLink() {
        return (
            <a 
                href={`https://www.are.na/${current.owner.slug}`} 
                target="_blank" 
                rel="noopener noreferrer"
            >
                {current.owner.name}
            </a>
        )
    }

    const linkOut = current.type == "Channel" ? 
        `https://www.are.na/${current.owner.slug}/${current.id}`
        : `https://www.are.na/block/${current.id}`;

    return (
        <div className="info-body">
            {current.type !== "Channel" && <BlockDisplay />}
            {(current.title || current.filename) && 
                <a 
                    className="h info-title"
                    href={(current.hasOwnProperty("url") ? current.url : linkOut)}
                    target="_blank"
                >{current.title ? current.title : current.filename}
            </a>}
            <div className="h info-subheader"><UserLink/> • {current.date}</div>
            <a className="info-id" href={linkOut} target="_blank">{current.id}</a>
            {current.description && <div><HTMLDecode rawHTML={current.description}/></div>}
            <div className="collections-children">
                
                {(current.type == "Channel" && current.childrenStatus.children.length > 0) && <div className="half">
                    <div className="check-header info-subheader">Contents</div>
                    <div className="check-header info-subheader">⇣</div>
                    <div className="list-container">
                        {current.childrenStatus.children.map((node: Block | Channel) => (
                            <div
                                key={node.id}
                                className="checklist"
                                onClick={() => makeNodeVisible(node.id, node)}
                            >
                                <a>{node.title || node.id}</a>
                                <input type="checkbox" readOnly checked={visibleIds.has(node.id.toString())}/>
                            </div>
                        ))}
                    </div>
                    {!current.childrenStatus.complete && <button 
                        className="loader" 
                        onClick={() => childrenFetcher(current.id, current.childrenStatus)}
                    >
                        Load more...
                    </button>}
                </div>}
                {current.connectionStatus.connections.length > 0 && <div className="half">
                    <div className="check-header info-subheader">Connections</div>
                    <div className="check-header info-subheader">⇣</div>
                    <div className="list-container">
                        {current.connectionStatus.connections.map((channel) => (
                            <div
                                key={channel.id}
                                className="checklist"
                                onClick={() => makeNodeVisible(channel.id, channel)}
                            >
                                <a>{channel.title || channel.id}</a>
                                <input type="checkbox" readOnly checked={visibleIds.has(channel.id.toString())}/>
                            </div>
                        ))}
                    </div>
                    {!current.connectionStatus.complete && <button 
                        className="loader" 
                        onClick={() => connectionFetcher(
                            current.id,
                            current.connectionStatus,
                            current.type === "Channel" ? "channels" : "blocks"
                        )}
                    >
                        Load more...
                    </button>}
                </div>}
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
    closePanel
}: InfoPanelPropsNull) {
    if (current) return (
        <Panel position="top-right" className="info-container">
            <div className="react-flow__controls info-box">
                <InfoPanelInner 
                        current={current} 
                        connectionFetcher={connectionFetcher}
                        childrenFetcher={childrenFetcher}
                        checkNodeVisible={checkNodeVisible}
                        makeNodeVisible={makeNodeVisible}
                    />
                
            </div>
            <button 
                onClick={() => closePanel()} 
                className="node-toolbar-button react-flow__controls popup-menu menu-title"
            >
                ✕
            </button>
        </Panel>
    )
}