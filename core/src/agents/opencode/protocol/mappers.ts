import type {AgentContext} from "../../types";
import {
    asShareSyncEnvelope,
    isRecord,
    isShareMessageMetadata,
    isShareTextContent,
    isShareToolContent,
    type ShareSyncEnvelope,
    type ShareToolContent,
} from "./types";
import type {ShareSyncRequest} from "../runtime/share-bridge";
import {OpencodeGrouper} from "../runtime/grouper";

const SESSION_REGEX = /session\s*id=(?<id>[A-Za-z0-9_-]+)/i;

export function handleOpencodeShareEvent(
    payload: ShareSyncRequest,
    ctx: AgentContext,
    grouper: OpencodeGrouper
) {
    const envelope: ShareSyncEnvelope = asShareSyncEnvelope(payload);
    const {sessionID, key, content} = envelope;
    grouper.ensureSession(sessionID, ctx);

    if (!key || typeof key !== "string") return;

    if (key.startsWith("session/message/") && isShareMessageMetadata(content)) {
        grouper.recordMessageRole(sessionID, content.id, content.role);
        return;
    }

    if (key.startsWith("session/part/")) {
        if (isShareTextContent(content)) {
            const text = content.text ?? "";
            grouper.recordMessagePart(sessionID, content.messageID, content.id, text);
            return;
        }
        if (isShareToolContent(content)) {
            grouper.handleToolEvent(ctx, content as ShareToolContent);
            return;
        }
    }
}

export function handleOpencodeLogLine(line: string, ctx: AgentContext) {
    try {
        const match = SESSION_REGEX.exec(line);
        if (match?.groups?.id) {
            ctx.emit({type: "session", id: match.groups.id});
        }
    } catch {
    }

    const level = line.startsWith("!  ") || line.startsWith("ERROR") ? "error" : "warn";
    ctx.emit({type: "log", level, message: `[opencode:stderr] ${line}`});
}
