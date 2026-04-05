"use client";
import { useCallback, useRef, useState } from "react";

const MENU_W = 200; // approximate pill width, used for clamping
const MENU_H = 44;  // approximate pill height

interface RadialMenuProps {
    origin: { x: number; y: number } | null;
    onClose: () => void;
    onAdd: (id: string) => void;
    onRandom: () => void;
}
  
export default function RadialMenu({ origin, onClose, onAdd, onRandom }: RadialMenuProps) {
    const [input, setInput] = useState("");
    const [inputOpen, setInputOpen] = useState(false);
  
    if (!origin) return null;
  
    // Clamp so pills don't overflow viewport
    const OFFSET = 70; // horizontal distance from origin to pill center
    const vw = window.innerWidth;
    const vh = window.innerHeight;
  
    const clamp = (val: number, lo: number, hi: number) => Math.min(Math.max(val, lo), hi);
  
    const topCenter = {
        x: clamp(origin.x, MENU_W / 2 + 8, vw - MENU_W / 2 - 8),
        y: clamp(origin.y - OFFSET, MENU_H / 2 + 8, vh - MENU_H / 2 - 8),
    };
    const bottomCenter = {
        x: clamp(origin.x , MENU_W / 2 + 8, vw - MENU_W / 2 - 8),
        y: clamp(origin.y + OFFSET, MENU_H / 2 + 8, vh - MENU_H / 2 - 8),
    };
  
  
    const submit = () => {
      if (!input.trim()) return;
      onAdd(input.trim());
      setInput("");
      setInputOpen(false);
      onClose();
    };

    const submitRandom = () => {
        onRandom();
        setInput("");
        setInputOpen(false);
        onClose();
    };
  
    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "auto" }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: topCenter.x,
                    top: topCenter.y,
                    transform: "translate(-50%,-50%)",
                    animation: "radial-top 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="react-flow__controls"
            >
                <div
                    style={{
                        padding: "6px 10px 6px 14px",
                        cursor: inputOpen ? "default" : "pointer",
                    }}
                    className=" popup-menu"
                    onClick={() => setInputOpen(true)}
                >
                    <span className="menu-title">
                        Node
                    </span>
                    {inputOpen ? (
                        <>
                            <input
                                autoFocus
                                type="text"
                                placeholder="Are.na URL/ID"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && submit()}
                                className="popup-menu-input"
                            />
                            <button
                                onClick={submit}
                                style={{
                                    background: "#111",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 999,
                                    padding: "3px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                            >
                                +
                            </button>
                        </>
                    ) : (
                        <button
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 18,
                                lineHeight: 1,
                                padding: 0,
                            }}
                        >
                            +
                        </button>
                    )}
                </div>
            </div>

            <div
                style={{
                    position: "absolute",
                    left: bottomCenter.x,
                    top: bottomCenter.y,
                    transform: "translate(-50%,-50%)",
                    animation: "radial-bottom 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="react-flow__controls"
            >
                <div
                    style={{
                        padding: "6px 10px 6px 14px",
                        cursor: "pointer",
                    }}
                    className="popup-menu"
                    onClick={submitRandom}
                >
                    <span className="menu-title">
                        Random
                    </span>
                    <button
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 18,
                            lineHeight: 1,
                            color: "#6b7280",
                            padding: 0,
                        }}
                    >
                        <img src="dice.svg" style={{maxHeight: 18}}/>
                    </button>
                </div>
            </div>
  
            <style>{`
                @keyframes radial-top {
                from { opacity: 0; transform: translate( -50%, calc(-50% + 80px)) scale(0.7); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes radial-bottom {
                from { opacity: 0; transform: translate(-50%, calc(-50% - 80px)) scale(0.7); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes radial-dot {
                from { opacity: 0; transform: translate(-50%,-50%) scale(0); }
                to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
                }
            `}
            </style>
      </div>
    );
}