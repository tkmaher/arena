"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function ImageViewer({
    setViewerOpen,
    imageUrl,
    title,
    linkOut
}: {
    setViewerOpen: (val: boolean) => void;
    imageUrl: string;
    title: string;
    linkOut: string;
}) {
    const [imageLoaded, setImageLoaded] = useState(false);

    const keyDownEvent = useCallback((e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.stopImmediatePropagation();
            setViewerOpen(false);
        }
    }, [setViewerOpen]);

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
            onClick={() => setViewerOpen(false)}
        >
            <motion.div
                key={imageUrl}
                className="info-media-wrap viewer"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : -8 }}
                transition={{ duration: 0.3 }}
                onClick={e => e.stopPropagation()} // prevent backdrop click closing when clicking image
            >
                <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    onLoad={() => setImageLoaded(true)}
                    className="info-media"
                />
            </motion.div>
            <div className="confirm-toolbar">
                <button>
                    <a href={linkOut} target="_blank">
                        {title} ↗
                    </a>
                </button>
            </div>
            <div className="confirm-toolbar">
                <button onClick={() => setViewerOpen(false)} className="node-toolbar-button react-flow__controls popup-menu menu-title">
                    Close
                </button>
            </div>
        </motion.div>
    );
}