type Params = Record<string, string | string[]>;

async function proxyToArena(request: Request, params: Params): Promise<Response> {
    const isReadOnly = request.method === "GET" || request.method === "HEAD";

    const cookie = request.headers.get("Cookie") ?? "";
    const token = cookie
        .split(";")
        .map(c => c.trim())
        .find(c => c.startsWith("arena_token="))
        ?.split("=")[1];

    if (!isReadOnly && !token) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const path = (params.path as string[]).join("/");
    const originalUrl = new URL(request.url);
    const arenaUrl = `https://api.are.na/v3/${path}${originalUrl.search}`;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const arenaRes = await fetch(arenaUrl, {
        method: request.method,
        headers,
        body: isReadOnly ? undefined : request.body,
    });

    // 204 No Content — return empty success
    if (arenaRes.status === 204) {
        return new Response(null, { status: 204 });
    }

    let data: unknown;
    try {
        data = await arenaRes.json();
    } catch {
        return new Response(null, { status: arenaRes.status });
    }

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