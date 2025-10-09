import {CommandAgent, type CommandSpec} from "../../command";
import type {Agent, AgentContext} from "../../types";
import type {z} from "zod";
import {
    OpencodeProfileSchema,
    defaultProfile,
    type OpencodeProfile,
} from "../profiles/schema";
import {
    buildOpencodeCommand,
    buildOpencodeFollowupCommand,
} from "../profiles/build";
import {ShareBridge} from "../runtime/share-bridge";
import {OpencodeGrouper} from "../runtime/grouper";
import {
    handleOpencodeLogLine,
    handleOpencodeShareEvent,
} from "../protocol/mappers";

type AttemptState = {
    bridge: ShareBridge;
    grouper: OpencodeGrouper;
    unsubscribe?: () => void;
};

const nowIso = () => new Date().toISOString();

class OpencodeImpl
    extends CommandAgent<z.infer<typeof OpencodeProfileSchema>>
    implements Agent<z.infer<typeof OpencodeProfileSchema>> {
    key = "OPENCODE" as const;
    label = "OpenCode Agent";
    defaultProfile = defaultProfile;
    profileSchema = OpencodeProfileSchema;
    capabilities = {resume: true};

    private attempts = new Map<string, AttemptState>();

    protected buildCommand(
        profile: OpencodeProfile,
        _ctx: AgentContext
    ): CommandSpec {
        const {base, params} = buildOpencodeCommand(profile);
        return {line: [base, ...params].join(" ")};
    }

    protected buildStdin(
        profile: OpencodeProfile,
        ctx: AgentContext
    ): string | undefined {
        const append = profile.appendPrompt || "";
        return [ctx.cardTitle, ctx.cardDescription ?? "", append]
            .filter(Boolean)
            .join("\n\n")
            .trim();
    }

    protected debugEnabled(profile: OpencodeProfile) {
        return !!profile.debug;
    }

    async run(ctx: AgentContext, profile: OpencodeProfile): Promise<number> {
        const state = await this.setupAttempt(ctx, profile);
        try {
            const {bridge, grouper} = state;
            this.attempts.set(ctx.attemptId, state);
            const {base, params} = buildOpencodeCommand(profile);
            const line = [base, ...params].join(" ");
            const prompt = this.buildStdin(profile, ctx);
            this.emitUserMessage(ctx, prompt);
            const stdin = prompt || undefined;
            return await this.runWithLine(ctx, profile, line, stdin, this.buildEnv(bridge));
        } finally {
            await this.teardownAttempt(ctx);
        }
    }

    async resume(ctx: AgentContext, profile: OpencodeProfile): Promise<number> {
        if (!ctx.sessionId) {
            ctx.emit({
                type: "log",
                level: "error",
                message: "[opencode] resume called without sessionId",
            });
            throw new Error("OpenCode resume requires sessionId");
        }
        const state = await this.setupAttempt(ctx, profile);
        try {
            this.attempts.set(ctx.attemptId, state);
            const {bridge} = state;
            const {base, params} = buildOpencodeFollowupCommand(profile, ctx.sessionId);
            const line = [base, ...params].join(" ");
            const prompt = (ctx.followupPrompt ?? "").trim();
            this.emitUserMessage(ctx, prompt);
            const stdin = prompt || undefined;
            ctx.emit({
                type: "log",
                level: "info",
                message: `[opencode] resume with session ${ctx.sessionId}`,
            });
            return await this.runWithLine(ctx, profile, line, stdin, this.buildEnv(bridge));
        } finally {
            await this.teardownAttempt(ctx);
        }
    }

    protected onStdoutText(line: string, ctx: AgentContext) {
        ctx.emit({type: "log", level: "info", message: `[opencode:stdout] ${line}`});
    }

    protected onStderrText(line: string, ctx: AgentContext) {
        handleOpencodeLogLine(line, ctx);
    }

    protected afterClose(_code: number, ctx: AgentContext) {
        const state = this.attempts.get(ctx.attemptId);
        if (state) {
            try {
                state.grouper.flush(ctx);
            } catch {
            }
        }
    }

    private async setupAttempt(ctx: AgentContext, profile: OpencodeProfile) {
        const debug = this.debugEnabled(profile);
        const bridge = await ShareBridge.start(
            debug
                ? {
                    debug: (message) =>
                        ctx.emit({type: "log", level: "info", message}),
                    error: (message) =>
                        ctx.emit({type: "log", level: "error", message}),
                }
                : undefined
        );
        const grouper = new OpencodeGrouper(ctx.worktreePath);
        const unsubscribe = bridge.subscribe((event) => {
            try {
                if (event.type === "sync") {
                    handleOpencodeShareEvent(event.payload, ctx, grouper);
                }
            } catch (err) {
                ctx.emit({
                    type: "log",
                    level: "warn",
                    message: `[opencode] failed to map share event: ${String(err)}`,
                });
            }
        });
        return {bridge, grouper, unsubscribe} satisfies AttemptState;
    }

    private async teardownAttempt(ctx: AgentContext) {
        const state = this.attempts.get(ctx.attemptId);
        if (!state) return;
        const {bridge, unsubscribe} = state;
        try {
            state.grouper.flush(ctx);
        } catch {
        }
        if (unsubscribe) {
            try {
                unsubscribe();
            } catch {
            }
        }
        try {
            await bridge.shutdown();
        } catch {
        }
        this.attempts.delete(ctx.attemptId);
    }

    private buildEnv(bridge: ShareBridge) {
        return {
            NODE_NO_WARNINGS: "1",
            OPENCODE_AUTO_SHARE: "1",
            OPENCODE_API: bridge.baseUrl,
        } satisfies Record<string, string>;
    }

    private emitUserMessage(ctx: AgentContext, content?: string | null) {
        const text = (content ?? "").trim();
        if (!text) return;
        ctx.emit({
            type: "conversation",
            item: {
                type: "message",
                timestamp: nowIso(),
                role: "user",
                text,
                format: "markdown",
            },
        });
    }
}

export const OpencodeAgent = new OpencodeImpl();
