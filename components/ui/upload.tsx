"use client";
import { useCallback, useEffect, useState } from "react";
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

    const [jsonData, setJsonData] = useState(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target.result);
            setJsonData(json);
            console.log("Parsed JSON:", json);
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
            <input type="file" accept=".json" onChange={handleFileUpload} />
        </motion.div>
    )
}