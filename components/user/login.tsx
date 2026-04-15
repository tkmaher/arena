"use client";

import { useEffect } from "react";
import { generateChallenge, generateVerifier } from "@/scripts/utility";
import { useGraphActions } from "@/context/graphcontext";

export default function LoginPage() {
  const { user, setUser } = useGraphActions();

  const REDIRECT_URI = "https://arena-flow.org/auth-response";

  useEffect(() => {
    function handler(event: MessageEvent) {
      console.log("MESSAGE RECEIVED:", event.data, event.origin);
      console.log(event.data.token);
  
      // if (event.origin !== window.location.origin) return; // TODO: uncomment
      if (event.data?.type !== "ARENA_AUTH_RESULT") return;
  
      if (event.data.success) {
        setUser(event.data.token)
      }
    }
  
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  async function login() {
    // if (!process.env.NEXT_PUBLIC_ARENA_CLIENT_ID) { // TODO: uncomment
    //     console.error("Missing client ID");
    // }

    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);

    sessionStorage.setItem("arena_pkce_verifier", verifier);

    const url =
      "https://www.are.na/oauth/authorize" +
      `?client_id=iwceyjA6tED7HpdjF5daMdPbtGF9MqdqXMKq3lYZ1NA` + // TODO: change
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=write` +
      `&code_challenge=${challenge}` +
      `&code_challenge_method=S256`;

    window.open(url, "_blank", "width=600,height=700");
  }

  return (
    <button onClick={login}>
      {user ? user.title : "Login with Are.na"}
    </button>
  );
}