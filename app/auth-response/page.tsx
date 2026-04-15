"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AuthResponsePage() {
  const params = useSearchParams();

  useEffect(() => {
    async function finish() {
      const code = params.get("code");
      const error = params.get("error");

      if (!window.opener) return;

      const origin = window.location.origin;

      if (error) {
        window.opener.postMessage(
          { type: "ARENA_AUTH_RESULT", success: false },
          origin
        );
        window.close();
        return;
      }

      if (!code) return;

      const verifier = sessionStorage.getItem("arena_pkce_verifier");

      const res = await fetch("https://dev.are.na/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: process.env.NEXT_PUBLIC_ARENA_CLIENT_ID,
          code,
          redirect_uri: process.env.NEXT_PUBLIC_ARENA_REDIRECT_URI,
          code_verifier: verifier,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("arena_token", data.access_token);

        window.opener.postMessage(
          { type: "ARENA_AUTH_RESULT", success: true },
          origin
        );
      } else {
        window.opener.postMessage(
          { type: "ARENA_AUTH_RESULT", success: false },
          origin
        );
      }

      window.close();
    }

    finish();
  }, [params]);

  return (
    <Suspense>
        <p>Signing in...</p>
    </Suspense>
  );
}