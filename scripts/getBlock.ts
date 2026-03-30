import { 
    Block, 
    ImageBlock, 
    LinkBlock, 
    TextBlock, 
    EmbedBlock, 
    Channel, 
    AttachmentBlock,
    ConnectionStatus,
    ChildrenStatus
} from "@/types/arena";

const CONNECTIONS_PER_PAGE = 50;

import { formattedDate } from "@/scripts/utility"

class ArenaApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly url?: string,
    ) {
        super(message);
        this.name = "ArenaApiError";
    }
}

async function arenaFetch(url: string | URL): Promise<any> {
    let response: Response;
    try {
        response = await fetch(url.toString(), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
    } catch (networkError) {
        throw new ArenaApiError(0, `Network error reaching Are.na: ${networkError}`, url.toString());
    }

    if (!response.ok) {
        // Try to pull a message from the response body; fall back gracefully.
        let serverMessage = "";
        try {
            const body = await response.json();
            serverMessage = body?.message ?? body?.error ?? "";
        } catch {
            // body wasn't JSON — that's fine, ignore
        }

        const reason = serverMessage
            ? `${response.status} ${response.statusText}: ${serverMessage}`
            : `${response.status} ${response.statusText}`;

        throw new ArenaApiError(response.status, reason, url.toString());
    }

    try {
        return await response.json();
    } catch {
        throw new ArenaApiError(
            response.status,
            "Are.na returned an invalid JSON response.",
            url.toString()
        );
    }
}
export async function getConnections(
    id: string,
    type: string,
    page: number
): Promise<ConnectionStatus> {
    const url = new URL(`https://api.are.na/v3/${type}/${id}/connections`);
    url.searchParams.set("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.set("page", page.toString());

    try {
        const data = await arenaFetch(url);
        const connections: Channel[] = await Promise.all(
            data.data.map((connection: any) => parseChannel(connection, false))
        );
        return { connections, complete: !data.meta.has_more_pages, page: page + 1 };
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[getConnections] API error for ${type}/${id} (page ${page}):`, error.message);
        } else {
            console.error(`[getConnections] Unexpected error for ${type}/${id}:`, error);
        }
        // Return a terminal state so the UI stops paginating.
        return { connections: [], complete: true, page };
    }
}

export async function getChildren(id: string, page: number): Promise<ChildrenStatus> {
    const url = new URL(`https://api.are.na/v3/channels/${id}/contents`);
    url.searchParams.set("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.set("page", page.toString());

    try {
        const data = await arenaFetch(url);
        const children: (Block | Channel)[] = (
            await Promise.all(
                data.data.map((child: any) =>
                    child.type === "Channel"
                        ? parseChannel(child, false)
                        : parseBlock(child, false)
                )
            )
        ).filter((item): item is Block | Channel => item !== null);

        return { children, complete: !data.meta.has_more_pages, page: page + 1 };
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[getChildren] API error for channel ${id} (page ${page}):`, error.message);
        } else {
            console.error(`[getChildren] Unexpected error for channel ${id}:`, error);
        }
        return { children: [], complete: true, page };
    }
}

export async function getBlock(id: string): Promise<Block | null> {
    try {
        const data = await arenaFetch(`https://api.are.na/v3/blocks/${id}`);
        return parseBlock(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 404) {
            console.warn(`[getBlock] Block "${id}" not found.`);
        } else if (error instanceof ArenaApiError) {
            console.error(`[getBlock] API error for block "${id}":`, error.message);
        } else {
            console.error(`[getBlock] Unexpected error for block "${id}":`, error);
        }
        return null;
    }
}

export async function getChannel(id: string): Promise<Channel | null> {
    try {
        const data = await arenaFetch(`https://api.are.na/v3/channels/${id}`);
        return parseChannel(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 404) {
            console.warn(`[getChannel] Channel "${id}" not found.`);
        } else if (error instanceof ArenaApiError) {
            console.error(`[getChannel] API error for channel "${id}":`, error.message);
        } else {
            console.error(`[getChannel] Unexpected error for channel "${id}":`, error);
        }
        return null;
    }
}

// ─── Parsers ───────────────────────────────────────────────────────────────────

async function parseBlock(data: any, performFetch: boolean): Promise<Block | null> {
    let conn: ConnectionStatus = { connections: [], complete: false, page: 1 };
    if (performFetch) conn = await getConnections(data.id, "blocks", 1);

    const block: Block = {
        id: data.id,
        date: formattedDate(data.created_at),
        title: data.title ?? null,
        description: data.description ? data.description.html : null,
        owner: { name: data.user.name, id: data.user.id, slug: data.user.slug },
        type: data.type,
        connectionStatus: conn,
    };

    switch (data.type) {
        case "Text": {
            const text = block as TextBlock;
            text.content = data.content.html;
            return text;
        }
        case "Image": {
            const image = block as ImageBlock;
            image.thumbnailUrl = data.image.small.src;
            image.imageUrl = data.image.large.src;
            return image;
        }
        case "Link": {
            const link = block as LinkBlock;
            link.url = data.source.url;
            link.urlTitle = data.source.title;
            link.thumbnailUrl = data.image ? data.image.small.src : null;
            link.imageUrl = data.image ? data.image.large.src : null;
            return link;
        }
        case "Embed": {
            const embed = block as EmbedBlock;
            embed.url = data.source.url;
            embed.urlTitle = data.source.title;
            embed.thumbnailUrl = data.embed.thumbnail_url ?? null;
            embed.embed = data.embed.html;
            return embed;
        }
        case "Attachment": {
            const attachment = block as AttachmentBlock;
            attachment.filename = data.attachment.filename;
            attachment.url = data.attachment.url;
            attachment.thumbnailUrl = data.image ? data.image.small.src : null;
            attachment.imageUrl = data.image ? data.image.large.src : null;
            return attachment;
        }
        default:
            console.warn(`[parseBlock] Unrecognised block type "${data.type}" for block ${data.id} — skipping.`);
            return null;
    }
}

async function parseChannel(data: any, performFetch: boolean): Promise<Channel> {
    let children: ChildrenStatus = { children: [], complete: false, page: 1 };
    let conn: ConnectionStatus = { connections: [], complete: false, page: 1 };

    if (performFetch) {
        [children, conn] = await Promise.all([
            getChildren(data.id, 1),
            getConnections(data.id, "channels", 1),
        ]);
    }

    return {
        id: data.id,
        date: formattedDate(data.created_at),
        title: data.title ?? null,
        description: data.description ? data.description.html : null,
        owner: { name: data.owner.name, id: data.owner.id, slug: data.owner.slug },
        type: "Channel",
        state: data.state,
        visibility: data.visibility,
        itemCount: data.counts.contents,
        blockCount: data.counts.blocks,
        channelCount: data.counts.channels,
        collaborations: data.collaborators
            ? data.collaborators.map((c: any) => ({ name: c.name, id: c.id, slug: c.slug }))
            : null,
        connectionStatus: conn,
        childrenStatus: children,
    };
}