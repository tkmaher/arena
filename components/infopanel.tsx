"use client";
import { useEffect, useState } from "react";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus } from "@/types/arena";
import Image from "next/image";
import { htmlDecode } from "@/scripts/utility";

function InfoPanelInner({ current, connectionFetcher, childrenFetcher }: InfoPanelProps) {
    useEffect(() => {
        if (!current) return;
        const controller = new AbortController();
      
        if (!current.connectionStatus.complete) {
            connectionFetcher(current.id, 
                current.connectionStatus, 
                current.type == "Channel" ? "channels" : "blocks"
            );
        }
        return () => controller.abort();
        }, 
        [
            current?.id,
            current?.connectionStatus.page,
            current?.connectionStatus.complete
        ]
    );

    useEffect(() => {
        if (!current || current.type !== "Channel") return;
        const controller = new AbortController();
      
        if (!current.connectionStatus.complete) {
            childrenFetcher(current.id, 
                current.childrenStatus
            );
        }
        return () => controller.abort();
        }, 
        [
            current?.id,
            current?.childrenStatus.page,
            current?.childrenStatus.complete
        ]
    );



    console.log("connections", current.connectionStatus.connections);
    
    function BlockDisplay() {
        const [imageLoaded, setImageLoaded] = useState(current.hasOwnProperty("thumbnailUrl") ? false : true);
        return (
            <div className="info-body" style={{opacity: imageLoaded ? 1 : 0}}>
                {current.type === "Image" && 
                    <Image
                        src={current.imageUrl}
                        alt={current.title || current.id}
                        fill
                        style={{opacity: imageLoaded ? 1 : 0}}
                        onLoad={() => setImageLoaded(true)}
                        placeholder="empty"
                        className="image"
                        onClick={() => window.open(`https://www.are.na/block/${current.id}`, "_blank")}
                    />
                }
                {current.type === "Text" &&
                    <p className="p-text">
                        {htmlDecode(current.content)}
                    </p>
                }
                {current.title && <div className="h info-title">{current.title}</div>}
                <div className="h info-subheader"><UserLink/> • {current.date}</div>
                {current.description && <div className="">{htmlDecode(current.description)}</div>}
                {current.connectionStatus.connections.length > 0 && <div>
                    Appears in...
                    {current.connectionStatus.connections.map((channel) => (
                        <div key={channel.id}>
                            <a 
                                href={`https://www.are.na/${channel.owner.slug}/${channel.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                            >
                                {channel.title || channel.id}
                            </a>
                        </div>
                    ))}
                </div>}
            </div>
        );
    }

    function ChannelDisplay() {
        return (
            <></>
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

    return (
        <BlockDisplay />
    );
}

interface InfoPanelProps {
    current: Block | Channel;
    connectionFetcher: (id: string, connectionStatus: ConnectionStatus, type: string) => Promise<void>;
    childrenFetcher: (id: string, childrenStatus: ChildrenStatus) => Promise<void>;
}

interface InfoPanelPropsNull {
    current: Block | Channel | null;
    connectionFetcher: (id: string, connectionStatus: ConnectionStatus, type: string) => Promise<void>;
    childrenFetcher: (id: string, childrenStatus: ChildrenStatus) => Promise<void>;

}

export default function InfoPanel({ current, connectionFetcher, childrenFetcher }: InfoPanelPropsNull) {
    return (
        <Panel position="top-right" className="react-flow__controls info-box">
            {current ? <InfoPanelInner 
                    current={current} 
                    connectionFetcher={connectionFetcher}
                    childrenFetcher={childrenFetcher}
                /> : 
                <div>Select a block or channel.</div>
            }
        </Panel>
    )
}