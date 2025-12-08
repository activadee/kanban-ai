export type ShareTextContent = {
    type: "text";
    id: string;
    messageID: string;
    sessionID: string;
    text?: string;
    time?: {
        start?: number;
        end?: number;
    };
};

export type ShareToolContent = {
    type: "tool";
    id: string;
    messageID: string;
    sessionID: string;
    callID?: string;
    tool: string;
    state?: ShareToolState;
};

export type ShareToolState = {
    status?: string;
    title?: string;
    output?: string;
    metadata?: ShareToolMetadata;
    input?: ShareToolInput;
};

export type ShareToolMetadata = {
    description?: string;
    exit?: number;
    diff?: string;
    count?: number;
    truncated?: boolean;
    preview?: string;
};

export type ShareTodoInfo = {
    content: string;
    status: string;
    priority?: string;
};

export type ShareToolInput = {
    filePath?: string;
    path?: string;
    include?: string;
    pattern?: string;
    command?: string;
    description?: string;
    url?: string;
    format?: string;
    timeout?: number;
    oldString?: string;
    newString?: string;
    replaceAll?: boolean;
    content?: string;
    todos?: ShareTodoInfo[];
};

export type ShareMessageMetadata = {
    id: string;
    role?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function isShareTextContent(value: unknown): value is ShareTextContent {
    if (!isRecord(value)) return false;
    return (
        value.type === "text" &&
        typeof value.id === "string" &&
        typeof value.messageID === "string" &&
        typeof value.sessionID === "string"
    );
}

export function isShareToolContent(value: unknown): value is ShareToolContent {
    if (!isRecord(value)) return false;
    return (
        value.type === "tool" &&
        typeof value.id === "string" &&
        typeof value.messageID === "string" &&
        typeof value.sessionID === "string" &&
        typeof value.tool === "string"
    );
}

export function isShareMessageMetadata(value: unknown): value is ShareMessageMetadata {
    if (!isRecord(value)) return false;
    if (typeof value.id !== "string") return false;
    if (value.role !== undefined && typeof value.role !== "string") return false;
    return true;
}
