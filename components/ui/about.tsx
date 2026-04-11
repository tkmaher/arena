"use client";
import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";

export default function About({setAbout}: {setAbout: (val: boolean) => void}) {
    const keyDownEvent = useCallback((e: any) => {
        if (e.key === "Escape") {
            setAbout(false);
        }
        
    }, [setAbout]);
    
    useEffect(() => {
        window.addEventListener("keydown", keyDownEvent);
        return () => window.removeEventListener("keydown", keyDownEvent);
    }, [keyDownEvent]);

    return (
        <motion.div
            className="confirm about"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <p className="info-title">
                <b>arena-flow.org</b> is a <a href="https://en.wikipedia.org/wiki/Directed_graph" target="_blank">directed graph</a> of <b><a target="_blank" href="https://are.na">are.na</a></b>.
            </p>
            <p className="info-text">
                <a target="_blank" href="https://are.na">are.na</a> is a content aggregation website made up of "blocks" and "channels". Blocks contain files uploaded by users,
                while channels are collections of those blocks (and may also contain channels themselves).
                The relationship between blocks and channels is unidrectional, but the relationship between channels and other channels is bidrectional. 
                With these rules in mind, arena-flow.org uses <a target="_blank" href="https://en.wikipedia.org/wiki/Adjacency_list">adjacency lists</a> to construct directed graphs based on the relationship between blocks and channels.
            </p>
            <p className="info-text">
                Click the canvas to add a node. Click a node to see its parents and children.
            </p>
            <div className="examples">
                <div className="example-box box solid">Selected</div>
                <div className="info-title">→</div>
                <div className="example-box box dotted">Adjacent</div>
                <div className="info-title">→</div>
                <div className="example-box box">Unselected</div>
            </div>
            <div className="info-text">
                
                <div className="example-links">
                    <div>See also:</div>
                    <a href="https://nemocake.github.io/website/graph/index.html" target="_blank">
                        https://nemocake.github.io/website/graph
                    </a>
                    <a href="https://goby.garden/arena/index/" target="_blank">
                        https://goby.garden/arena/index/
                    </a>
                    <a href="https://www.are.na/block/42631273" target="_blank">
                        https://www.are.na/block/42631273
                    </a>
                    <a href="https://github.com/nicschumann/arena-connectome" target="_blank">
                        https://github.com/nicschumann/arena-connectome
                    </a>
                </div>
            </div>
            <br/>
            <div className="confirm-toolbar">
                <button onClick={() => setAbout(false)} className="node-toolbar-button react-flow__controls popup-menu menu-title">
                    Close
                </button>
            </div>
        </motion.div>
    )
}