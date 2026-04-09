"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Upload({setUpload, uploadHandler}: {
    setUpload: (val: boolean) => void,
    uploadHandler: (data: any) => void
}) {
    const keyDownEvent = useCallback((e: any) => {
        if (e.key === "Escape") {
            setUpload(false);
        }
        
    }, [setUpload]);
    
    useEffect(() => {
        window.addEventListener("keydown", keyDownEvent);
        return () => window.removeEventListener("keydown", keyDownEvent);
    }, [keyDownEvent]);

    const handleFileUpload = (e: React.SubmitEvent) => {
        e.preventDefault();
        const fileInput = e.target.querySelector('input[type="file"]');
        const file = fileInput.files[0];
        if (!file) return;
        console.log("Selected file:", file);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                console.log("Parsed JSON:", json);
                uploadHandler(json);
                setUpload(false);
            } catch (error) {
                alert("Invalid JSON file!");
            }
        };
        reader.readAsText(file);
    };

    return (
        <motion.div
            className="confirm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <form onSubmit={handleFileUpload} className=" confirm-toolbar">
                <input 
                    type="file" 
                    accept=".json" 
                    className="node-toolbar-button react-flow__controls popup-menu menu-title"
                    id="file-upload"
                />
                <button  className="node-toolbar-button react-flow__controls popup-menu menu-title" type="submit">
                    Submit
                </button>
                <button onClick={() => setUpload(false)} className="node-toolbar-button react-flow__controls popup-menu menu-title">
                    Cancel
                </button>
            </form>
            <em>Import a JSON file. This will replace the current graph.</em>
        </motion.div>
    )
}