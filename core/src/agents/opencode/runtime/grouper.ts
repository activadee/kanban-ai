import path from "node:path";
import type {AgentContext} from "../../types";
import type {ConversationItem} from "shared";
import type {
    ShareToolState,
    ShareToolContent,
} from "../protocol/types";

const nowIso = () => new Date().toISOString();

type MessageState = {
    role?: string;
    order: string[];
    parts: Map<string, string>;
};

export class OpencodeGrouper {
    private readonly messageStates = new Map<string, MessageState>();
    private readonly messageOrder: string[] = [];
    private readonly emittedMessages = new Set<string>();
    private emittedSessionId = false;

    constructor(private readonly worktreePath: string) {
    }

    ensureSession(sessionId: string | undefined, ctx: AgentContext) {
        if (!sessionId || this.emittedSessionId) return;
        this.emittedSessionId = true;
        ctx.emit({type: "session", id: sessionId});
    }

    recordMessageRole(
        sessionId: string,
        messageId: string,
        role: string | undefined
    ) {
        const key = this.messageKey(sessionId, messageId);
        const state = this.getMessageState(key);
        state.role = role;
    }

    recordMessagePart(
        sessionId: string,
        messageId: string,
        partId: string,
        text: string
    ) {
        const key = this.messageKey(sessionId, messageId);
        const state = this.getMessageState(key);
        if (!state.order.includes(partId)) {
            state.order.push(partId);
        }
        state.parts.set(partId, text);
    }

    handleToolEvent(ctx: AgentContext, payload: ShareToolContent) {
        const status = payload.state?.status;
        if (!status || (status !== "completed" && status !== "error")) return;
        const item = this.buildToolConversationItem(payload);
        if (item) ctx.emit({type: "conversation", item});
    }

    flush(ctx: AgentContext) {
        for (const messageKey of this.messageOrder) {
            if (this.emittedMessages.has(messageKey)) continue;
            const state = this.messageStates.get(messageKey);
            if (!state) continue;
            const role = normalizeRole(state.role);
            if (!role || role === "user") continue;
            const text = state.order
                .map((partId) => state.parts.get(partId) ?? "")
                .join("");
            if (!text.trim()) continue;
            const item: ConversationItem = {
                type: "message",
                timestamp: nowIso(),
                role,
                text,
                format: "markdown",
                profileId: ctx.profileId ?? null,
            };
            ctx.emit({type: "conversation", item});
            this.emittedMessages.add(messageKey);
        }
    }

    private getMessageState(key: string): MessageState {
        let state = this.messageStates.get(key);
        if (!state) {
            state = {
                role: undefined,
                order: [],
                parts: new Map(),
            };
            this.messageStates.set(key, state);
            this.messageOrder.push(key);
        }
        return state;
    }

    private messageKey(sessionId: string, messageId: string) {
        return `${sessionId}:${messageId}`;
    }

    private buildToolConversationItem(payload: ShareToolContent): ConversationItem | null {
        const startedAt = nowIso();
        const status = payload.state?.status ?? "";
        const convStatus = mapToolStatus(status);
        const invocation = {
            name: payload.tool,
            action: null,
            command: null,
            cwd: null,
            status: convStatus,
            startedAt,
            completedAt: convStatus === "running" ? null : nowIso(),
            durationMs: null,
            exitCode: payload.state?.metadata?.exit ?? null,
            stdout: payload.state?.output ?? null,
            stderr: null,
            metadata: this.buildToolMetadata(payload),
        } as const;
        return {
            type: "tool",
            timestamp: nowIso(),
            tool: invocation,
        };
    }

    private buildToolMetadata(payload: ShareToolContent): Record<string, unknown> | undefined {
        const state = payload.state;
        if (!state) return undefined;
        const meta: Record<string, unknown> = {};
        if (state.title) meta.title = state.title;
        if (state.metadata?.description) meta.description = state.metadata.description;
        if (state.metadata?.diff) meta.diff = state.metadata.diff;
        if (state.metadata?.preview) meta.preview = state.metadata.preview;
        if (state.metadata?.count !== undefined) meta.count = state.metadata.count;
        if (state.metadata?.truncated !== undefined) meta.truncated = state.metadata.truncated;
        if (state.input) meta.input = normalizeToolInput(state.input, this.worktreePath);
        return Object.keys(meta).length ? meta : undefined;
    }
}

function normalizeRole(role?: string) {
    if (!role) return undefined;
    switch (role) {
        case "system":
        case "user":
            return role;
        default:
            return "assistant";
    }
}

function mapToolStatus(status: string) {
    switch (status) {
        case "running":
            return "running";
        case "completed":
            return "succeeded";
        case "error":
            return "failed";
        default:
            return "created";
    }
}

function normalizeToolInput(input: ShareToolState["input"], worktreePath: string) {
    if (!input) return undefined;
    const result: Record<string, unknown> = {};
    const rel = (value?: string | null) =>
        value ? makeRelative(value, worktreePath) : undefined;
    if (input.filePath) result.filePath = rel(input.filePath);
    if (input.path) result.path = rel(input.path);
    if (input.include) result.include = input.include;
    if (input.pattern) result.pattern = input.pattern;
    if (input.command) result.command = input.command;
    if (input.description) result.description = input.description;
    if (input.url) result.url = input.url;
    if (input.format) result.format = input.format;
    if (input.timeout !== undefined) result.timeout = input.timeout;
    if (input.oldString) result.oldString = input.oldString;
    if (input.newString) result.newString = input.newString;
    if (input.todos) result.todos = input.todos;
    return result;
}

function makeRelative(target: string, worktreePath: string) {
    try {
        if (!path.isAbsolute(target)) return target;
        const rel = path.relative(worktreePath, target);
        return rel || ".";
    } catch {
        return target;
    }
}
