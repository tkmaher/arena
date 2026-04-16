"use client";

import { useEffect } from "react";
import { login } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";
import { Block, Channel, User, Group, ToggleOptions } from "@/types/arena";

interface LoginProps {
  checkNodeVisible: (id: string) => boolean;
  onToggle:         (opts: ToggleOptions) => void;
  onSelect:         (node: Block | Channel | User | Group) => void;
}

export default function LoginPage({ checkNodeVisible, onToggle, onSelect }: LoginProps) {
  const { user, setUser } = useGraphActions();

  useEffect(() => {
    function handler(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "ARENA_AUTH_RESULT") return;
      if (event.data.success) setUser(event.data.token);
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function UserPage() {
    if (!user) return null;
    return (
      <div>
        <div className="checklist">
          <a onClick={() => onSelect(user.user)}>
            {user.user.title ?? user.user.id}
          </a>
          <input
            type="checkbox"
            checked={checkNodeVisible(user.user.id)}
            onChange={() => onToggle({
              id: user.user.id,
              body: user.user,
              linkOptions: { shouldLink: false },  // auth user has no canvas peer to link to
            })}
          />
        </div>
        <div className="checklist">
          <a onClick={async () => {
            await fetch("/api/logout", { method: "POST", headers: { "Content-Type": "application/json" } });
            setUser(null);
          }}>
            Log out
          </a>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => !user && login()} className="login">
      {user ? <UserPage /> : <em>Log in with Are.na</em>}
    </button>
  );
}