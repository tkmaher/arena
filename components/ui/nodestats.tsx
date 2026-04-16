"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Panel } from "@xyflow/react";
import { useGraphEngine } from "@/hooks/useGraphEngine";
import NodeList from "@/components/ui/nodelist";
import { Block, Channel, Group, ToggleOptions, User } from "@/types/arena";
import Login from "../user/login";

interface NodeStatsProps {
    checkNodeVisible: (id: string) => boolean;
    makeNodeVisible:  (data: ToggleOptions) => void;
    setSelected:      (id: string) => void;
    engine:           ReturnType<typeof useGraphEngine>;
}

export default function NodeStats({ checkNodeVisible, makeNodeVisible, setSelected, engine }: NodeStatsProps) {
    const objects = useRef<(Block | Channel | User | Group)[]>(engine.nodes.map(n => n.data.object));
    const [isOpen, setOpen] = useState(false);

    const handleSelect = (node: Block | Channel | User | Group) =>
        checkNodeVisible(node.id)
            ? setSelected(node.id)
            : makeNodeVisible({ id: node.id, body: node });

    useEffect(() => {
        objects.current = engine.nodes.map(n => n.data.object);
    }, [engine.nodes]);

    const onToggle = useCallback((node: Block | Channel | User | Group) => {
        makeNodeVisible({ id: node.id, body: node });
    }, [makeNodeVisible]);

    return (
        <Panel position="top-right" style={{ zIndex: 0 }}>
            <div className="react-flow__controls">
                <Login
                    checkNodeVisible={checkNodeVisible}
                    onToggle={makeNodeVisible}
                    onSelect={handleSelect}
                />
            </div>
            <div className="react-flow__controls popup-menu node-toolbar-button stat-label">
                Nodes: <b>{engine.nodes.length}</b> | Edges: <b>{engine.edges.length}</b>
            </div>
            <div
                className="info-section-scroll react-flow__controls info-stats"
                style={{ height: isOpen ? "300px" : "fit-content", transition: "height 1s ease-in-out" }}
            >
                <NodeList
                    list={objects.current}
                    status={{ complete: true, children: [], page: 0 }}
                    checkNodeVisible={checkNodeVisible}
                    onToggle={onToggle}
                    onSelect={handleSelect}
                    loadMore={() => {}}
                    nodeId="nodes"
                    label="Nodes"
                    limitSize={setOpen}
                />
            </div>
        </Panel>
    );
}