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
    owner: User | Group;
    title?: string;
    description?: string;

    type: string;

    state: string;
    visibility: string;
    itemCount: number;
    blockCount: number;
    channelCount: number;
    collaborations: User[] | null;

    connectionStatus: ConnectionStatus;
    childrenStatus: ChildrenStatus;
}

export interface User {
    title: string;
    id: string;
    slug: string;
    thumbnailUrl?: string; // avatar
    imageUrl?: string;  // avatar
    description?: string;

    type: string;

    followersStatus: FollowersStatus;
    followingStatus: FollowingStatus;
    childrenStatus: ChildrenStatus;
}

export interface Group {
    id: string;
    title: string;
    slug: string;
    description?: string;
    thumbnailUrl?: string;
    imageUrl?: string;

    type: string;

    followersStatus: FollowersStatus;
    childrenStatus: ChildrenStatus; // TODO: How to get group members/
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

export interface FollowingStatus {
    following: (User | Channel | Group)[];
    complete: boolean;
    page: number;
}

export interface FollowersStatus {
    followers: (User)[];
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