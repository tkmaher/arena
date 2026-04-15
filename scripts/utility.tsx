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

export function generateVerifier() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  
    let result = "";
    for (let i = 0; i < 64; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
  
export async function generateChallenge(verifier: string) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
  
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
}