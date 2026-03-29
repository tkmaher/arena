"use client";
import { useCallback, useRef, useState } from "react";

const MENU_W = 200; // approximate pill width, used for clamping
const MENU_H = 44;  // approximate pill height

interface RadialMenuProps {
    origin: { x: number; y: number } | null;
    onClose: () => void;
    onAddBlock: (id: string) => void;
    onAddChannel: (id: string) => void;
}
  
export default function RadialMenu({ origin, onClose, onAddBlock, onAddChannel }: RadialMenuProps) {
    const [blockInput, setBlockInput] = useState("");
    const [channelInput, setChannelInput] = useState("");
    const [blockOpen, setBlockOpen] = useState(false);
    const [channelOpen, setChannelOpen] = useState(false);
  
    if (!origin) return null;
  
    // Clamp so pills don't overflow viewport
    const OFFSET = 130; // horizontal distance from origin to pill center
    const vw = window.innerWidth;
    const vh = window.innerHeight;
  
    const clamp = (val: number, lo: number, hi: number) => Math.min(Math.max(val, lo), hi);
  
    const leftCenter = {
      x: clamp(origin.x - OFFSET, MENU_W / 2 + 8, vw - MENU_W / 2 - 8),
      y: clamp(origin.y, MENU_H / 2 + 8, vh - MENU_H / 2 - 8),
    };
    const rightCenter = {
      x: clamp(origin.x + OFFSET, MENU_W / 2 + 8, vw - MENU_W / 2 - 8),
      y: clamp(origin.y, MENU_H / 2 + 8, vh - MENU_H / 2 - 8),
    };
  
    const submitBlock = () => {
      if (!blockInput.trim()) return;
      onAddBlock(blockInput.trim());
      setBlockInput("");
      setBlockOpen(false);
      onClose();
    };
  
    const submitChannel = () => {
      if (!channelInput.trim()) return;
      onAddChannel(channelInput.trim());
      setChannelInput("");
      setChannelOpen(false);
      onClose();
    };
  
    return (
      // Invisible overlay catches outside-clicks to dismiss
      <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "auto" }}
          onMouseDown={(e) => {
              // Only close if clicking the backdrop itself, not the pills
              if (e.target === e.currentTarget) onClose();
          }}
      >
  
          <div
              style={{
                  position: "absolute",
                  left: leftCenter.x,
                  top: leftCenter.y,
                  transform: "translate(-50%,-50%)",
                  animation: "radial-left 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="react-flow__controls"
          >
              <div
                  style={{
                      padding: blockOpen ? "6px 10px 6px 14px" : "6px 16px",
                      cursor: blockOpen ? "default" : "pointer",
                  }}
                  className=" popup-menu"
                  onClick={() => setBlockOpen(true)}
              >
                  <span className="menu-title">
                      Block
                  </span>
                  {blockOpen ? (
                      <>
                          <input
                              autoFocus
                              type="text"
                              placeholder="ID…"
                              value={blockInput}
                              onChange={(e) => setBlockInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && submitBlock()}
                              className="popup-menu-input"
                          />
                          <button
                              onClick={submitBlock}
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
                              Add
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
                              color: "#6b7280",
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
                  left: rightCenter.x,
                  top: rightCenter.y,
                  transform: "translate(-50%,-50%)",
                  animation: "radial-right 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="react-flow__controls"
          >
              <div
                  style={{
                      padding: channelOpen ? "6px 10px 6px 14px" : "6px 16px",
                      cursor: channelOpen ? "default" : "pointer",
                  }}
                  className="popup-menu"
                  onClick={() => setChannelOpen(true)}
              >
                  <span className="menu-title">
                      Channel
                  </span>
                  {channelOpen ? (
                      <>
                          <input
                              autoFocus
                              type="text"
                              placeholder="ID…"
                              value={channelInput}
                              onChange={(e) => setChannelInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && submitChannel()}
                              className="popup-menu-input"
                          />
                          <button
                              onClick={submitChannel}
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
                              Add
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
                          color: "#6b7280",
                          padding: 0,
                      }}
                      >
                          +
                      </button>
                  )}
              </div>
          </div>
  
          <style>{`
              @keyframes radial-left {
              from { opacity: 0; transform: translate(calc(-50% + 80px), -50%) scale(0.7); }
              to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              }
              @keyframes radial-right {
              from { opacity: 0; transform: translate(calc(-50% - 80px), -50%) scale(0.7); }
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