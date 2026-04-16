"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChannelList } from "./channelselect";
import { BlockCreation, ChannelCreation } from "@/types/arena";

export default function CreatePopup({
    setOpen, 
    type,
    createChannel,
    createBlock
}: {
    setOpen: (val: boolean) => void, 
    type: string,
    createChannel: (data: ChannelCreation) => Promise<null | string>;
    createBlock: (data: BlockCreation) => Promise<null | string>;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [body, setBody] = useState("");
    const [gid, setGid] = useState("");
    const isChannel: boolean = type === "channels";

    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggleChannel = (channelId: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(channelId) ? next.delete(channelId) : next.add(channelId);
            return next;
        });
    };

    const keyDownEvent = useCallback((e: any) => {
        if (e.key === "Escape") {
            setOpen(false);
        }
        
    }, [setOpen]);
    
    useEffect(() => {
        window.addEventListener("keydown", keyDownEvent);
        return () => window.removeEventListener("keydown", keyDownEvent);
    }, [keyDownEvent]);

    const handleCreate = () => {
        if (!isChannel) {
            if (body == "") {
                alert("Please enter the block contents.");
                return;
            } else if (selected.size == 0) {
                alert("Please select at least one channel.");
                return;
            }
            createBlock(
                {
                    value: body,
                    channel_ids: Array.from(selected),
                    title: title != "" ? title : undefined,
                    description: description != "" ? description : undefined,
                }
            );
        }
        if (isChannel && title == "") {
            alert("Please specify a title.");
            return;
        }
        createChannel(
            {
                title: title,
                visibility: "public", // TODO: make selection
                description: description != "" ? description : undefined,
                group_id: gid != "" ? gid : undefined
            }
        );
        setOpen(false);
    };

    return (
        <motion.div
            className="confirm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <p className="info-title">
                Create a {isChannel ? "channel" : "block"}
            </p>
            {!isChannel && <textarea
                id="body"
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Content (paste a URL or enter text)"
                autoFocus
                style={{marginBottom: "0.8em"}}
                className="text-input"
            />}

            <input
                id="name"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                style={{marginBottom: "0.8em"}}
                className="text-input"
            />
            <input
                id="desc"
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description"
                style={{marginBottom: "0.8em"}}
                className="text-input"
            />

            {isChannel && <input
                id="gid"
                type="text"
                value={gid}
                onChange={e => setGid(e.target.value)}
                placeholder="Group ID"
                style={{marginBottom: "0.8em"}}
                className="text-input"
            />}

            {!isChannel && <ChannelList id={""} selected={selected} toggleChannel={toggleChannel}/>}

            <div className="confirm-toolbar">
                <button onClick={handleCreate} className="node-toolbar-button react-flow__controls popup-menu menu-title">
                    Create {isChannel ? "channel" : "block"}
                </button>
                <button onClick={() => setOpen(false)} className="node-toolbar-button react-flow__controls popup-menu menu-title">
                    Close
                </button>
            </div>
        </motion.div>
    )
}