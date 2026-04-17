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
    User,
    AuthUser,
    ChannelCreation,
    BlockCreation
} from "@/types/arena";

const CONNECTIONS_PER_PAGE = 50;

import { formattedDate } from "@/scripts/utility";

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

// ─── Core fetch ───────────────────────────────────────────────────────────────

interface FetchOptions {
    method?: string;
    body?: unknown;
}

async function arenaFetch(url: string | URL, options: FetchOptions = {}): Promise<any> {
    const method = options.method ?? "GET";
    const original = new URL(url.toString());
    const proxyUrl = original.href.replace(ARENA_BASE, ARENA_BASE);

    let response: Response;
    try {
        response = await fetch(proxyUrl, {
            method,
            headers: { "Content-Type": "application/json" },
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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

    // 204 No Content
    if (response.status === 204) return null;

    try {
        return await response.json();
    } catch {
        return null;
    }
}

// ─── Read operations ─────────────────────────────────────────────────────────

export async function getConnections(
    id: string,
    type: string,
    page: number
): Promise<ConnectionStatus> {
    const url = new URL(`${ARENA_BASE}/${type}/${id}/connections`);
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
        return { connections: [], complete: true, page };
    }
}

export async function getChildren(
    id: string,
    page: number,
    type: string
): Promise<ChildrenStatus> {
    const url = new URL(`${ARENA_BASE}/${type}/${id}/contents`);
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
            console.error(`[getChildren] API error for ${type}/${id} (page ${page}):`, error.message);
        } else {
            console.error(`[getChildren] Unexpected error for ${type}/${id}:`, error);
        }
        return { children: [], complete: true, page };
    }
}

export async function getFollowing(id: string, page: number): Promise<FollowingStatus> {
    const url = new URL(`${ARENA_BASE}/users/${id}/following`);
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

export async function getFollowers(
    id: string,
    page: number,
    type: string
): Promise<FollowersStatus> {
    const url = new URL(`${ARENA_BASE}/${type}/${id}/followers`);
    url.searchParams.set("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.set("page", page.toString());

    try {
        const data = await arenaFetch(url);
        const followers: User[] = (
            await Promise.all(data.data.map((child: any) => parseUser(child, false)))
        ).filter((item): item is User => item !== null);
        return { followers, complete: !data.meta.has_more_pages, page: page + 1 };
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[getFollowers] API error for ${type}/${id} (page ${page}):`, error.message);
        } else {
            console.error(`[getFollowers] Unexpected error for ${type}/${id}:`, error);
        }
        return { followers: [], complete: true, page };
    }
}

export async function getBlock(id: string): Promise<Block | null> {
    try {
        const data = await arenaFetch(`${ARENA_BASE}/blocks/${id}`);
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
        const data = await arenaFetch(`${ARENA_BASE}/channels/${id}`);
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
        const data = await arenaFetch(`${ARENA_BASE}/users/${id}`);
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
        const data = await arenaFetch(`${ARENA_BASE}/groups/${id}`);
        return parseGroup(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 404) {
            console.warn(`[getGroup] Group "${id}" not found.`);
        } else if (error instanceof ArenaApiError) {
            console.error(`[getGroup] API error for group "${id}":`, error.message);
        } else {
            console.error(`[getGroup] Unexpected error for group "${id}":`, error);
        }
        return null;
    }
}

// ─── Create operations ────────────────────────────────────────────────────────

/**
 * Create a new channel.
 * status: "public" | "closed" | "private"
 */
export async function createChannel(
    data: ChannelCreation
): Promise<Channel | null> {
    let body: Record<string, string | string[]> = {
        title: data.title,
        visibility: data.visibility
    };
    if (data.description) body.description = data.description;
    if (data.group_id) body.group_id = data.group_id;

    try {
        const data = await arenaFetch(`${ARENA_BASE}/channels`, {
            method: "POST",
            body
        });
        return parseChannel(data, false);
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error("[createChannel] API error:", error.message);
        } else {
            console.error("[createChannel] Unexpected error:", error);
        }
        return null;
    }
}

/**
 * Create a block inside a channel. Returns the new block from the API.
 * The are.na API mirrors the new block back from
 *   POST /v3/channels/:channel_id/blocks
 */
export async function createBlock(
    data: BlockCreation
): Promise<Block | null> {
    let body: Record<string, string | string[]> = {
        value: data.value,
        channel_ids: data.channel_ids
    };
    if (data.title) body.title = data.title;
    if (data.description) body.description = data.description

    try {
        const data = await arenaFetch(`${ARENA_BASE}/blocks`, {
            method: "POST",
            body
        });
        return parseBlock(data, true);
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[createBlock] API error for new block "${data.value}":`, error.message);
        } else {
            console.error(`[createBlock] Unexpected error:`, error);
        }
        return null;
    }
}

/**
 * Connect an existing block/channel to one or more channels.
 * POST /v3/connections  { connectable_id, connectable_type, channel_ids[] }
 */
export async function createConnection(
    childId: string,
    type: string,
    parentIds: string[]
): Promise<boolean> {
    try {
        await arenaFetch(`${ARENA_BASE}/connections`, {
            method: "POST",
            body: {
                connectable_id:   childId,
                connectable_type: type,
                channel_ids:      parentIds,
            },
        });
        return true;
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 401) {
            console.warn("[createConnection] No valid session.");
        } else {
            console.error("[createConnection] Unexpected error:", error);
        }
        return false;
    }
}

// ─── Delete operations ────────────────────────────────────────────────────────


/** Permanently delete a channel you own. */
export async function deleteChannel(id: string): Promise<boolean> {
    try {
        await arenaFetch(`${ARENA_BASE}/channels/${id}`, { method: "DELETE" });
        return true;
    } catch (error) {
        if (error instanceof ArenaApiError) {
            console.error(`[deleteChannel] API error for channel "${id}":`, error.message);
        } else {
            console.error("[deleteChannel] Unexpected error:", error);
        }
        return false;
    }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function setUser(): Promise<AuthUser | null> {
    try {
        const data = await arenaFetch(`${ARENA_BASE}/me`);
        let user = await parseUser(data, false);
        let count = 1;
        while (!user.childrenStatus.complete && count < 120) {
            const res = await getChildren(user.id, user.childrenStatus.page, "users");
            user.childrenStatus.children.push(...res.children);
            user.childrenStatus.complete = res.complete;
            user.childrenStatus.page = res.page;
            ++count;
        }
        while (!user.followersStatus.complete && count < 120) {
            const res = await getFollowers(user.id, user.followersStatus.page, "users");
            user.followersStatus.followers.push(...res.followers);
            user.followersStatus.complete = res.complete;
            user.followersStatus.page = res.page;
            ++count;
        }
        while (!user.followingStatus.complete && count < 120) {
            const res = await getFollowing(user.id, user.followingStatus.page);
            user.followingStatus.following.push(...res.following);
            user.followingStatus.complete = res.complete;
            user.followingStatus.page = res.page;
            ++count;
        }
        const superUser: AuthUser = {
            user,
            followers: new Set(user.followersStatus.followers),
            following: new Set(user.followingStatus.following),
            children:  new Set(user.childrenStatus.children),
        };
        return superUser;
    } catch (error) {
        if (error instanceof ArenaApiError && error.status === 401) {
            console.warn("[setUser] No valid session.");
        } else {
            console.error("[setUser] Unexpected error:", error);
        }
        return null;
    }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

async function parseBlock(data: any, performFetch: boolean): Promise<Block | null> {
    let conn: ConnectionStatus = { connections: [], complete: false, page: 1 };
    if (performFetch) conn = await getConnections(data.id, "blocks", 1);
    const owner = await parseUser(data.user, false);
  
    const block: Block = {
      id:               data.id,
      date:             formattedDate(data.created_at),
      title:            data.title ?? null,
      description:      data.description ? data.description.html : null,
      owner,
      type:             data.type,
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
        image.imageUrl     = data.image.large.src;
        return image;
      }
      case "Link": {
        const link = block as LinkBlock;
        link.url          = data.source.url;
        link.urlTitle     = data.source.title;
        link.thumbnailUrl = data.image ? data.image.small.src : null;
        link.imageUrl     = data.image ? data.image.large.src : null;
        return link;
      }
      case "Embed": {
        const embed = block as EmbedBlock;
        embed.url          = data.source.url;
        embed.urlTitle     = data.source.title;
        embed.thumbnailUrl = data.image?.small?.src ?? null;
        embed.embed        = data.embed.html;
        return embed;
      }
      case "Attachment": {
        const attachment = block as AttachmentBlock;
        attachment.filename     = data.attachment.filename;
        attachment.url          = data.attachment.url;
        attachment.thumbnailUrl = data.image ? data.image.small.src : null;
        attachment.imageUrl     = data.image ? data.image.large.src : null;
        return attachment;
      }
      default:
        console.warn(`[parseBlock] Unrecognised block type "${data.type}" for block ${data.id} — returning base block.`);
        return block;
    }
  }

async function parseChannel(data: any, performFetch: boolean): Promise<Channel> {
    let children: ChildrenStatus   = { children: [],   complete: false, page: 1 };
    let conn: ConnectionStatus     = { connections: [], complete: false, page: 1 };
    const owner = data.owner.type === "Group"
        ? await parseGroup(data.owner, false)
        : await parseUser(data.owner, false);

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
        owner,
        type: "Channel",
        state: data.state,
        visibility: data.visibility,
        itemCount:    data.counts.contents,
        blockCount:   data.counts.blocks,
        channelCount: data.counts.channels,
        collaborations: data.collaborators
            ? data.collaborators.map((c: any) => parseUser(c, false))
            : null,
        connectionStatus: conn,
        childrenStatus:   children,
    };
}

async function parseUser(data: any, performFetch: boolean): Promise<User> {
    let children:  ChildrenStatus  = { children: [],   complete: false, page: 1 };
    let followers: FollowersStatus = { followers: [],  complete: false, page: 1 };
    let following: FollowingStatus = { following: [],  complete: false, page: 1 };

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
        thumbnailUrl: data.avatar ?? null,
        imageUrl:     data.avatar ?? null,
        description:  data.bio ? data.bio.html : null,
        type: "User",
        followingStatus: following,
        childrenStatus:  children,
        followersStatus: followers,
    };
}

async function parseGroup(data: any, performFetch: boolean): Promise<Group> {
    let children:  ChildrenStatus  = { children: [],  complete: false, page: 1 };
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
        thumbnailUrl: data.avatar ?? null,
        imageUrl:     data.avatar ?? null,
        description:  data.bio ? data.bio.html : null,
        type: "Group",
        childrenStatus:  children,
        followersStatus: followers,
    };
}