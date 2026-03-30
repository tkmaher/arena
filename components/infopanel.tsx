"use client";
import { useEffect, useState } from "react";
import { Panel } from "@xyflow/react";
import { Block, Channel, ChildrenStatus, ConnectionStatus } from "@/types/arena";
import Image from "next/image";
import { htmlDecode } from "@/scripts/utility";

function InfoPanelInner({ current, connectionFetcher, childrenFetcher }: InfoPanelProps) {
    const [imageLoaded, setImageLoaded] = useState(current.hasOwnProperty("thumbnailUrl") ? false : true);

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
                    <p className="p-text">
                        {htmlDecode(current.content)}
                    </p>
                }
                {current.type == "Attachment" &&
                    <iframe 
                        className="p-iframe" 
                        src={current.url}
                    />
                }
                
                {current.type == "Embed" &&
                    <script>{current.embed}</script>
                }
            </>
        );
    }

    function ChannelDisplay({channel}: {channel: Channel}) {
        useEffect(() => {
            if (!channel) return;
            const controller = new AbortController();
          
            if (!channel.connectionStatus.complete) {
                childrenFetcher(current.id, 
                    channel.childrenStatus
                );
            }
            return () => controller.abort();
            }, 
            [
                channel.id,
                channel.childrenStatus.page,
                channel.childrenStatus.complete
            ]
        );
        return (
            <>
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
            { (current.type != "Channel") ? <BlockDisplay /> : <ChannelDisplay channel={current} /> }
            {(current.title || current.filename) && 
                <a 
                    className="h info-title"
                    href={(current.hasOwnProperty("url") ? current.url : linkOut)}
                    target="_blank"
                >{current.title ? current.title : current.filename}
            </a>}
            <div className="h info-subheader"><UserLink/> • {current.date}</div>
            <a className="info-id" href={linkOut} target="_blank">{current.id}</a>
            {current.description && <div className="">{htmlDecode(current.description)}</div>}
            {current.connectionStatus.connections.length > 0 && <div>
                Connections
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

interface InfoPanelProps {
    current: Block | Channel;
    connectionFetcher: (id: string, connectionStatus: ConnectionStatus, type: string) => Promise<void>;
    childrenFetcher: (id: string, childrenStatus: ChildrenStatus) => Promise<void>;
}

interface InfoPanelPropsNull {
    current: Block | Channel | undefined;
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