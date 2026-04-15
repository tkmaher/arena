const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

async function proxyToArena(request: Request, params: Params): Promise<Response> {
    const cookie = request.headers.get("Cookie") ?? "";
    const token = cookie.split(";").map(c => c.trim())
        .find(c => c.startsWith("arena_token="))?.split("=")[1];

    if (!token) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const path = (params.path as string[]).join("/");
    const originalUrl = new URL(request.url);
    const arenaUrl = `https://api.are.na/v3/${path}${originalUrl.search}`;

    const arenaRes = await fetch(arenaUrl, {
        method: request.method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    });

    const data = await arenaRes.json();
    return new Response(JSON.stringify(data), {
        status: arenaRes.status,
        headers: { "Content-Type": "application/json" },
    });
}

export const onRequestGet:    PagesFunction = ({ request, params }) => proxyToArena(request, params);
export const onRequestPost:   PagesFunction = ({ request, params }) => proxyToArena(request, params);
export const onRequestPut:    PagesFunction = ({ request, params }) => proxyToArena(request, params);
export const onRequestDelete: PagesFunction = ({ request, params }) => proxyToArena(request, params);
export const onRequestPatch:  PagesFunction = ({ request, params }) => proxyToArena(request, params);