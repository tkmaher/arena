import DOMPurify from 'dompurify';

export function HTMLDecode({rawHTML}: {rawHTML: string}) {
    const sanitizedHTML = DOMPurify.sanitize(rawHTML);
    const createMarkup = () => {
        return { __html: sanitizedHTML };
    };

    return <div dangerouslySetInnerHTML={createMarkup()} />;
};

export function formattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}


// for token authentication

export async function login() {
    const REDIRECT_URI = "https://arena-flow.org/auth-response";

    if (!process.env.NEXT_PUBLIC_ARENA_CLIENT_ID) { // TODO: uncomment
        console.error("Missing client ID");
    }

    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);

    sessionStorage.setItem("arena_pkce_verifier", verifier);

    const url =
      "https://www.are.na/oauth/authorize" +
      `?client_id=${process.env.NEXT_PUBLIC_ARENA_CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&response_type=code` +
      `&scope=write` +
      `&code_challenge=${challenge}` +
      `&code_challenge_method=S256`;

    window.open(url, "_blank", "width=600,height=700");
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