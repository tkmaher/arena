export interface Block {
    id: string;
    date: string;
    owner: User;
    title?: string;
    description?: string;

    type: string;

    connectionStatus: ConnectionStatus;
}

export interface Channel {
    id: string;
    date: string;
    owner: User;
    title?: string;
    description?: string;

    type: "Channel";

    state: string;
    visibility: string;
    itemCount: number;
    blockCount: number;
    channelCount: number;
    collaborations?: User[];

    connectionStatus: ConnectionStatus;
    childrenStatus: ChildrenStatus;
}

export interface User {
    name: string;
    id: number;
    slug: string;
}

export interface ConnectionStatus {
    connections: Channel[];
    complete: boolean;
    page: number;
}

export interface ChildrenStatus {
    children: (Block | Channel)[];
    complete: boolean;
    page: number;
}

export interface ImageBlock extends Block {
    imageUrl: string;
    thumbnailUrl: string;
}

export interface TextBlock extends Block {
    content: string;
}

export interface LinkBlock extends Block {
    url: string;
    urlTitle: string;
    imageUrl?: string;
    thumbnailUrl?: string;
}

export interface AttachmentBlock extends Block {
    filename: string;
    url: string;
    imageUrl?: string;
    thumbnailUrl?: string;
}

export interface EmbedBlock extends Block {
    url: string;
    urlTitle: string;
    thumbnailUrl?: string;
    embed: string;
}