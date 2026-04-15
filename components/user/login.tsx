"use client";

import { useEffect } from "react";
import { login } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";
import { Block, Channel, User, Group } from "@/types/arena";

interface LoginProps {
  checkNodeVisible: (id: string) => boolean;
  onToggle:         (node: Block | Channel | User | Group) => void;
  onSelect:         (node: Block | Channel | User | Group) => void;
}

export default function LoginPage({checkNodeVisible, onToggle, onSelect}: LoginProps) {
  const { user, setUser } = useGraphActions();


  useEffect(() => {
    function handler(event: MessageEvent) {
      console.log("MESSAGE RECEIVED:", event.data, event.origin);
      console.log(event.data.token);
  
      if (event.origin !== window.location.origin) return; 
      if (event.data?.type !== "ARENA_AUTH_RESULT") return;
  
      if (event.data.success) {
        setUser(event.data.token)
      }
    }
  
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  

  function UserPage() {
    if (!user) return;

    return (
      <div>
        <div
          className="checklist"
        >
          <a onClick={() => onSelect(user)}>
            {user.title ?? user.id}
          </a>

          <input
            type="checkbox"
            checked={checkNodeVisible(user.id)}
            onChange={() => onToggle(user)}
          />
        </div>
      </div>
    )
  }

  return (
    <button onClick={login}>
      {user ? <UserPage/> : "Login with Are.na"}
    </button>
  );
}