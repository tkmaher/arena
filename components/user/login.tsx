"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [connected, setConnected] = useState(false);

  const REDIRECT_URI = "https://arena-flow.org/auth-response";

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
        console.log("received:", event.data);
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "ARENA_AUTH_RESULT") return;

        if (event.data.success) setConnected(true);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function login() {
    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);

    sessionStorage.setItem("arena_pkce_verifier", verifier);

    const url =
      "https://www.are.na/oauth/authorize" +
      `?client_id=${process.env.NEXT_PUBLIC_ARENA_CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=read` +
      `&code_challenge=${challenge}` +
      `&code_challenge_method=S256`;

    window.open(url, "_blank", "width=600,height=700");
  }

  return (
    <button onClick={login}>
      {connected ? "Connected ✓" : "Login with Are.na"}
    </button>
  );
}

function generateVerifier() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function generateChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}