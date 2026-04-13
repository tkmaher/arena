"use client";

import { useCallback, useState } from "react";

import { Panel } from "@xyflow/react";
import { useGraphEngine } from "@/hooks/useGraphEngine";
import NodeList from "@/components/ui/nodelist";
import { useEffect, useRef } from "react";
import { Block, Channel, Group, User } from "@/types/arena";

interface NodeStatsProps {
    checkNodeVisible: (id: string) => boolean;
    makeNodeVisible: (id: string, node: Block | Channel | User | Group) => void;
    setSelected: (id: string) => void;
    engine: ReturnType<typeof useGraphEngine>;
}

export default function NodeStats({checkNodeVisible, makeNodeVisible, setSelected, engine}: NodeStatsProps) {
    const objects = useRef<(Block | Channel | User | Group)[]>(engine.nodes.map(n => n.data.object));
    const toggleNode    = (node: Block | Channel | User | Group) => makeNodeVisible(node.id, node);
    const handleSelect  = (node: Block | Channel | User | Group) =>
        checkNodeVisible(node.id) ? setSelected(node.id) : makeNodeVisible(node.id, node);
    const [isOpen, setOpen] = useState(false);

    const limitSize = useCallback((val: boolean) => {
        setOpen(val);
    }, [setOpen]);

    const style = {
        height: isOpen ? "300px" : "fit-content",
        transition: "height 1s ease-in-out"
    }

    useEffect(() => {
        objects.current = engine.nodes.map(n => n.data.object);
    }, [engine.nodes]);

    return (
        <Panel position="top-right" style={{zIndex: 0}}>
            {/* <div className="logo-container react-flow__controls">
                <img src="logotext.svg"/>
                <img className="logo-hover" src="logostar.svg"/>
            </div>   */}
            <div className="react-flow__controls popup-menu node-toolbar-button stat-label">
                Nodes: <b>{engine.nodes.length}</b> | Edges: <b>{engine.edges.length}</b>
                
            </div>
            <div 
                className="info-section-scroll react-flow__controls info-stats" 
                style={style}
            >
                <NodeList 
                    list={objects.current} 
                    status={{complete: true, children: [], page: 0}}
                    checkNodeVisible={checkNodeVisible}
                    onToggle={toggleNode}
                    onSelect={handleSelect}
                    loadMore={() => {}}
                    nodeId="nodes"
                    label="Nodes"
                    limitSize={limitSize}
                />
            </div>
        </Panel>
    )
}