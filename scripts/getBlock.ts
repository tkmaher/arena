import { 
    Block, 
    ImageBlock, 
    LinkBlock, 
    TextBlock, 
    EmbedBlock, 
    Channel, 
    AttachmentBlock,
    ConnectionStatus,
    ChildrenStatus,
    FollowersStatus,
    FollowingStatus,
    Group,
    User
} from "@/types/arena";

const CONNECTIONS_PER_PAGE = 25;

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

const ARENA_BASE = "https://api.are.na/v3";
const PROXY_BASE = "/api/arena";

async function arenaFetch(url: string | URL): Promise<any> {
    const original = new URL(url.toString());
    const proxyUrl = original.href.replace(ARENA_BASE, ARENA_BASE);

    let response: Response;
    try {
        response = await fetch(proxyUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
           
        });
    } catch (networkError) {
        throw new ArenaApiError(0, `Network error: ${networkError}`, proxyUrl);
    }

    if (!response.ok) {
        let serverMessage = "";
        try {
            const body: any = await response.json();
            serverMessage = body?.message ?? body?.error ?? "";
        } catch { }

        throw new ArenaApiError(
            response.status,
            serverMessage || `${response.status} ${response.statusText}`,
            proxyUrl
        );
    }

    try {
        return await response.json();
    } catch {
        throw new ArenaApiError(response.status, "Invalid JSON response.", proxyUrl);
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

// types: users/channels/groups
export async function getChildren(
    id: string, 
    page: number, 
    type: string
): Promise<ChildrenStatus> {
    const url = new URL(`https://api.are.na/v3/${type}/${id}/contents`);
    url.searchParams.set("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.set("page", page.toString());
    if (type === "users" || type === "groups") url.searchParams.set("type", "Channel");

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

export async function getFollowing(id: string, page: number): Promise<FollowingStatus> {
    const url = new URL(`https://api.are.na/v3/users/${id}/following`);
    url.searchParams.set("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.set("page", page.toString());

    try {
        const data = await arenaFetch(url);
        const following: (Group | Channel | User)[] = (
            await Promise.all(
                data.data.map((child: any) => {
                    if (child.type === "User")         return parseUser(child, false);
                    else if (child.type === "Channel") return parseChannel(child, false);
                    else if (child.type === "Group")   return parseGroup(child, false);
                })
            )
        ).filter((item): item is User | Channel | Group => item !== null);

        return { following, complete: !data.meta.has_more_pages, page: page + 1 };
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[getFollowing] API error for user ${id} (page ${page}):`, error.message);
        } else {
            console.error(`[getFollowing] Unexpected error for user ${id}:`, error);
        }
        return { following: [], complete: true, page };
    }
}

// types: users/groups
export async function getFollowers(
    id: string, 
    page: number,
    type: string
): Promise<FollowersStatus> {
    const url = new URL(`https://api.are.na/v3/${type}/${id}/followers`);
    url.searchParams.set("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.set("page", page.toString());
    console.log("Fetching followers from URL:", url.toString());

    try {
        const data = await arenaFetch(url);
        const followers: (User)[] = (
            await Promise.all(
                data.data.map((child: any) =>
                    parseUser(child, false)
                )
            )
        ).filter((item): item is User => item !== null);

        return { followers, complete: !data.meta.has_more_pages, page: page + 1 };
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[getFollowers] API error for user ${id} (page ${page}):`, error.message);
        } else {
            console.error(`[getFollowers] Unexpected error for user ${id}:`, error);
        }
        return { followers: [], complete: true, page };
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

export async function getUser(id: string): Promise<User | null> {
    try {
        const data = await arenaFetch(`https://api.are.na/v3/users/${id}`);
        return parseUser(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 404) {
            console.warn(`[getUser] User "${id}" not found.`);
        } else if (error instanceof ArenaApiError) {
            console.error(`[getUser] API error for user "${id}":`, error.message);
        } else {
            console.error(`[getUser] Unexpected error for user "${id}":`, error);
        }
        return null;
    }
}

export async function getGroup(id: string): Promise<Group | null> {
    try {
        const data = await arenaFetch(`https://api.are.na/v3/groups/${id}`);
        return parseGroup(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 404) {
            console.warn(`[getGroup] User "${id}" not found.`);
        } else if (error instanceof ArenaApiError) {
            console.error(`[getGroup] API error for user "${id}":`, error.message);
        } else {
            console.error(`[getGroup] Unexpected error for user "${id}":`, error);
        }
        return null;
    }
}

// ─── Parsers ───────────────────────────────────────────────────────────────────

async function parseBlock(data: any, performFetch: boolean): Promise<Block | null> {
    let conn: ConnectionStatus = { connections: [], complete: false, page: 1 };
    if (performFetch) conn = await getConnections(data.id, "blocks", 1);
    const owner = await parseUser(data.user, false);

    const block: Block = {
        id: data.id,
        date: formattedDate(data.created_at),
        title: data.title ?? null,
        description: data.description ? data.description.html : null,
        owner: owner,
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
            embed.thumbnailUrl = data.image.small.src ?? null;
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
    const owner = data.owner.type === "Group" ? await parseGroup(data.owner, false) : await parseUser(data.owner, false);

    if (performFetch) {
        [children, conn] = await Promise.all([
            getChildren(data.id, 1, "channels"),
            getConnections(data.id, "channels", 1),
        ]);
    }

    return {
        id: data.id,
        date: formattedDate(data.created_at),
        title: data.title ?? null,
        description: data.description ? data.description.html : null,
        owner: owner,
        type: "Channel",
        state: data.state,
        visibility: data.visibility,
        itemCount: data.counts.contents,
        blockCount: data.counts.blocks,
        channelCount: data.counts.channels,
        collaborations: data.collaborators
            ? data.collaborators.map((c: any) => (parseUser(c, false)))
            : null,
        connectionStatus: conn,
        childrenStatus: children,
    };
}

async function parseUser(data: any, performFetch: boolean): Promise<User> {
    let children: ChildrenStatus = { children: [], complete: false, page: 1 };
    let followers: FollowersStatus = { followers: [], complete: false, page: 1 };
    let following: FollowingStatus = { following: [], complete: false, page: 1 };

    if (performFetch) {
        [children, followers, following] = await Promise.all([
            getChildren(data.id, 1, "users"),
            getFollowers(data.id, 1, "users"),
            getFollowing(data.id, 1),
        ]);
    }


    return {
        id: data.id,
        title: data.name,
        slug: data.slug,
        thumbnailUrl: data.avatar ? data.avatar : null,
        imageUrl: data.avatar ? data.avatar : null,
        description: data.bio ? data.bio.html : null,

        type: "User",
        
        followingStatus: following,
        childrenStatus: children,
        followersStatus: followers,
    };
}

async function parseGroup(data: any, performFetch: boolean): Promise<Group> {
    let children: ChildrenStatus = { children: [], complete: false, page: 1 };
    let followers: FollowersStatus = { followers: [], complete: false, page: 1 };

    if (performFetch) {
        [children, followers] = await Promise.all([
            getChildren(data.id, 1, "groups"),
            getFollowers(data.id, 1, "groups"),
        ]);
    }

    return {
        id: data.id,
        title: data.name,
        slug: data.slug,
        thumbnailUrl: data.avatar ? data.avatar : null,
        imageUrl: data.avatar ? data.avatar : null,
        description: data.bio ? data.bio.html : null,

        type: "Group",
        
        childrenStatus: children,
        followersStatus: followers,
    };
}

export async function setUser() {
    try {
        const data = await arenaFetch(`${ARENA_BASE}/me`);
        return parseUser(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 401) {
            console.warn("[setUser] No valid session.");
        } else {
            console.error("[setUser] Unexpected error:", error);
        }
        return null;
    }
}