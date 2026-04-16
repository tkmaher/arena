"use client";

import { useEffect } from "react";

export default function AuthResponseClient({
  code,
  error,
}: {
  code: string | null;
  error: string | null;
}) {
  useEffect(() => {
    async function run() {
      try {
        console.log("AUTH RESPONSE LOADED", { code, error });

        // MUST be popup
        if (!window.opener) {
          console.log("No window.opener — not a popup");
          return;
        }

        const origin = window.location.origin;

        // Error case (user denied)
        if (error) {
          window.opener.postMessage(
            { type: "ARENA_AUTH_RESULT", success: false, error },
            origin
          );

          setTimeout(() => window.close(), 200);
          return;
        }

        if (!code) {
          window.opener.postMessage(
            { type: "ARENA_AUTH_RESULT", success: false },
            origin
          );

          setTimeout(() => window.close(), 200);
          return;
        }

        const verifier = sessionStorage.getItem("arena_pkce_verifier");

        console.log("Exchanging code for token with verifier", verifier);

        const REDIRECT_URI = "https://arena-flow.org/auth-response";
                
        const res = await fetch("https://api.are.na/v3/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: process.env.NEXT_PUBLIC_ARENA_CLIENT_ID, 
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
          }),
        });

        const data: any = await res.json();
        

        console.log("TOKEN RESPONSE", data);

        console.log(data.toString(), data.access_token);

        if (!res.ok) {
          window.opener.postMessage(
            { type: "ARENA_AUTH_RESULT", success: false },
            origin
          );

          setTimeout(() => window.close(), 200);
          return;
        }

        localStorage.setItem("arena_token", data.access_token);

        window.opener.postMessage(
          { type: "ARENA_AUTH_RESULT", success: true, token: data.access_token },
          origin 
        );

        console.log("Posted message to opener");

        setTimeout(() => {
          window.close();
        }, 200);
      } catch (err) {
        console.error("AUTH FLOW ERROR", err);

        if (window.opener) {
          window.opener.postMessage(
            { type: "ARENA_AUTH_RESULT", success: false },
            window.location.origin
          );
        }

        setTimeout(() => window.close(), 200);
      }
    }

    run();
  }, [code, error]);

  return <p className="confirm">Completing login...</p>;
}