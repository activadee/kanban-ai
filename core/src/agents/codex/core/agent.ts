import {z} from "zod";
import {CommandAgent, type CommandSpec} from "../../command";
import type {Agent, AgentContext} from "../../types";
import {
    CodexProfileSchema,
    defaultProfile,
    type CodexProfile,
} from "../profiles/schema";
import {
    buildCodexCommand,
    buildCodexFollowupCommand,
} from "../profiles/build";
import {handleCodexEnvelope} from "../protocol/mappers";
import {CodexGrouper} from "../runtime/groupers";

class CodexImpl
    extends CommandAgent<z.infer<typeof CodexProfileSchema>>
    implements Agent<z.infer<typeof CodexProfileSchema>> {
    key = "CODEX";
    label = "Codex Agent";
    defaultProfile = defaultProfile;
    profileSchema = CodexProfileSchema;
    capabilities = {resume: true};

    private groupers = new Map<string, CodexGrouper>();

    protected buildCommand(
        profile: CodexProfile,
        _ctx: AgentContext
    ): CommandSpec {
        const {base, params} = buildCodexCommand(profile);
        return {
            line: [base, ...params].join(" "),
            env: {NODE_NO_WARNINGS: "1", RUST_LOG: "info"},
        };
    }

    protected buildStdin(
        profile: CodexProfile,
        ctx: AgentContext
    ): string | undefined {
        const append = profile.appendPrompt || "";
        return [ctx.cardTitle, ctx.cardDescription ?? "", append]
            .filter(Boolean)
            .join("\n\n")
            .trim();
    }

    protected debugEnabled(profile: CodexProfile) {
        return !!profile.debug;
    }

    async run(ctx: AgentContext, profile: CodexProfile): Promise<number> {
        // Per-attempt state holder
        const grouper = new CodexGrouper();
        this.groupers.set(ctx.attemptId, grouper);
        try {
            return await super.run(ctx, profile);
        } finally {
            // ensure flush and cleanup
            try {
                grouper.flush(ctx);
            } catch {
            }
            this.groupers.delete(ctx.attemptId);
        }
    }

    protected onStdoutJson(obj: unknown, ctx: AgentContext, _profile: CodexProfile) {
        const g = this.groupers.get(ctx.attemptId) || new CodexGrouper();
        handleCodexEnvelope(obj, ctx, g);
    }

    protected onStdoutText(line: string, ctx: AgentContext) {
        ctx.emit({type: "log", level: "info", message: `[codex:stdout] ${line}`});
    }

    protected onStderrText(line: string, ctx: AgentContext) {
        // Try to extract session id from stderr (Codex CLI logs)
        try {
            const m =
                /session_id:\s*(?:ConversationId\()?(?<id>[0-9a-fA-F-]{36})\)?/.exec(
                    line
                );
            if (m?.groups?.id) {
                const id = m.groups.id;
                ctx.emit({
                    type: "log",
                    level: "info",
                    message: `[codex:session] id=${id}`,
                });
                ctx.emit({type: "session", id});
            }
        } catch {
        }
        ctx.emit({type: "log", level: "warn", message: `[codex:stderr] ${line}`});
    }

    protected afterClose(_code: number, ctx: AgentContext) {
        const g = this.groupers.get(ctx.attemptId);
        if (g) g.flush(ctx);
    }

    // Follow-up support: resume a prior Codex session with a new prompt
    async resume(ctx: AgentContext, profile: CodexProfile): Promise<number> {
        if (!ctx.sessionId) {
            ctx.emit({type: 'log', level: 'error', message: '[codex] resume called without sessionId'})
            throw new Error('Codex resume requires sessionId')
        }
        const grouper = new CodexGrouper()
        this.groupers.set(ctx.attemptId, grouper)
        const {base, params} = buildCodexFollowupCommand(profile, ctx.sessionId);
        const line = [base, ...params].join(" ");
        const stdin = (ctx.followupPrompt ?? "").trim();
        ctx.emit({
            type: "log",
            level: "info",
            message: `[codex] resume with session ${ctx.sessionId}`,
        });
        // Use runWithLine to reuse subprocess management
        try {
            return await this.runWithLine(ctx, profile, line, stdin || undefined, {
                NODE_NO_WARNINGS: "1",
            });
        } finally {
            try {
                grouper.flush(ctx)
            } catch {
            }
            this.groupers.delete(ctx.attemptId)
        }
    }
}

export const CodexAgent = new CodexImpl();
