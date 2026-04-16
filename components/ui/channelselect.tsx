"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGraphActions } from "@/context/graphcontext";
import { Channel } from "@/types/arena";

export default function ChannelSelect({
    setSelectOpen,
    id,
    type
}: {
    setSelectOpen: (val: boolean) => void;
    id: string;
    type: string;
}) {
    const { makeConnection, user } = useGraphActions();
    if (!user) return;

    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const channels = Array.from(user.user.childrenStatus.children).filter(
        (child): child is Channel => child.type === "Channel"
    );

    const filtered = channels.filter(ch =>
        (ch.title ?? ch.id).toLowerCase().includes(search.toLowerCase())
    );

    const toggleChannel = (channelId: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(channelId) ? next.delete(channelId) : next.add(channelId);
            return next;
        });
    };

    const handleConnect = () => {
        makeConnection(id, type, Array.from(selected));
        setSelectOpen(false);
    };

    const keyDownEvent = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopImmediatePropagation();
            setSelectOpen(false);
        }
    }, [setSelectOpen]);

    useEffect(() => {
        window.addEventListener("keydown", keyDownEvent, true);
        return () => window.removeEventListener("keydown", keyDownEvent, true);
    }, [keyDownEvent]);

    return (
        <motion.div
            className="confirm about"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="info-media-wrap viewer"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onClick={e => e.stopPropagation()}
            >
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search channels..."
                    autoFocus
                />

                <ul>
                    {filtered.map(ch => (
                        <li key={ch.id}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={selected.has(ch.id)}
                                    onChange={() => toggleChannel(ch.id)}
                                />
                                {ch.title ?? ch.id}
                            </label>
                        </li>
                    ))}
                    {filtered.length === 0 && <li>No channels found</li>}
                </ul>
            </motion.div>

            <div className="confirm-toolbar">
                <button
                    onClick={handleConnect}
                    disabled={selected.size === 0}
                    className="node-toolbar-button react-flow__controls popup-menu menu-title"
                >
                    Connect ({selected.size})
                </button>
                <button
                    onClick={() => setSelectOpen(false)}
                    className="node-toolbar-button react-flow__controls popup-menu menu-title"
                >
                    Close
                </button>
            </div>
        </motion.div>
    );
}