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

async function getConnections(id: string, type: string, page: number): Promise<ConnectionStatus> {
    const url = new URL(`https://api.are.na/v3/${type}/${id}/connections`);
    url.searchParams.append("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.append("page", page.toString());
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        const connections: Channel[] = await Promise.all(
            data.data.map((connection: any) => parseChannel(connection, false))
        );
        console.log("block connections:", connections);
        return { connections, complete: data.has_more_pages, page: page + 1 };
    } catch (error) {
        console.error("Error fetching connections:", error);
        return { connections: [], complete: true, page };
    }
}

async function getChildren(id: string, page: number, type: string): Promise<ChildrenStatus> {
    const url = new URL(`https://api.are.na/v3/${type}/${id}/contents`);
    url.searchParams.append("per", CONNECTIONS_PER_PAGE.toString());
    url.searchParams.append("page", page.toString());
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        const children: (Block | Channel)[] = await Promise.all(
            data.data.map((child: any) =>
                child.type === "Channel" ? parseChannel(child, false) : parseBlock(child, false)
            )
        );
        return { children, complete: data.has_more_pages, page: page + 1 };
    } catch (error) {
        console.error("Error fetching children:", error);
        return { children: [], complete: true, page };
    }
}

async function parseBlock(data: any, performFetch: boolean): Promise<Block | undefined> {
    let conn: ConnectionStatus = { connections: [], complete: false, page: 1 };
    if (performFetch)
        conn = await getConnections(data.id, "blocks", 1);

    const block: Block = {
        id: data.id,
        date: data.created_at,
        title: data.title ?? null,
        description: data.description ? data.description.html : null,
        owner: { name: data.user.name, id: data.user.id },
        type: data.type,
        connectionStatus: conn
    };

    if (data.type === "Text") {
        const text = block as TextBlock;
        text.content = data.content.html;
        return text;
    } else if (data.type === "Image") {
        const image = block as ImageBlock;
        image.thumbnailUrl = data.image.small.src;
        image.imageUrl = data.image.src;
        return image;
    } else if (data.type === "Link") {
        const link = block as LinkBlock;
        link.url = data.source.url;
        link.urlTitle = data.source.title;
        link.imageUrl = data.image ? data.image.src : null;
        link.thumbnailUrl = data.image ? data.image.small.src : null;
        return link;
    } else if (data.type === "Embed") {
        const embed = block as EmbedBlock;
        embed.url = data.source.url;
        embed.urlTitle = data.source.title;
        embed.thumbnailUrl = data.embed.thumbnail_url ?? null;
        embed.embed = data.embed.html;
        return embed;
    } else if (data.type === "Attachment") {
        const attachment = block as AttachmentBlock;
        attachment.filename = data.attachment.filename;
        attachment.url = data.attachment.url;
        attachment.thumbnailUrl = data.image ? data.image.small.src : null;
        attachment.imageUrl = data.image ? data.image.src : null;
        return attachment;
    }
}

async function parseChannel(data: any, performFetch: boolean): Promise<Channel> {
    let children: ChildrenStatus = { children: [], complete: false, page: 1 };
    let conn: ConnectionStatus = { connections: [], complete: false, page: 1 };

    if (performFetch) {
        children = await getChildren(data.id, 1, "channels");
        conn = await getConnections(data.id, "channels", 1);
    }

    return {
        id: data.id,
        date: data.created_at,
        title: data.title ?? null,
        description: data.description ? data.description.html : null,
        owner: { name: data.owner.name, id: data.owner.id },
        state: data.state,
        visibility: data.visibility,
        itemCount: data.counts.contents,
        blockCount: data.counts.blocks,
        channelCount: data.counts.channels,
        collaborations: data.collaborators ? data.collaborators.map((collaborator: any) => ({
            name: collaborator.name,
            id: collaborator.id
        })) : null,
        connectionStatus: conn,
        childrenStatus: children
    };
}

export async function getBlock(id: string): Promise<Block | undefined> {
    try {
        const response = await fetch(`https://api.are.na/v3/blocks/${id}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        console.log(data);
        return parseBlock(data, true);
    } catch (error) {
        console.error("Error fetching block:", error);
        return undefined;
    }
}

export async function getChannel(id: string): Promise<Channel | undefined> {
    try {
        const response = await fetch(`https://api.are.na/v3/channels/${id}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        return parseChannel(data, true);
    } catch (error) {
        console.error("Error fetching channel:", error);
        return undefined;
    }
}