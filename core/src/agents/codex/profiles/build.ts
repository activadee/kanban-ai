import type {CodexProfile} from "./schema";

export function buildCodexCommand(config: CodexProfile) {
    const base = (config.baseCommandOverride?.trim() ||
        "npx -y @openai/codex@0.38.0 exec") as string;
    const params: string[] = ["--json", "--skip-git-repo-check"];
    if (config.sandbox === "auto") params.push("--full-auto");
    else if (config.sandbox) {
        params.push("--sandbox", config.sandbox);
        if (config.sandbox === "danger-full-access")
            params.push("--dangerously-bypass-approvals-and-sandbox");
    }
    if (config.oss) params.push("--oss");
    if (config.model) params.push("--model", config.model);
    if (config.modelReasoningEffort)
        params.push(
            "--config",
            `model_reasoning_effort=${config.modelReasoningEffort}`
        );
    if (config.modelReasoningSummary)
        params.push(
            "--config",
            `model_reasoning_summary=${config.modelReasoningSummary}`
        );
    if (config.additionalParams?.length) params.push(...config.additionalParams);
    return {base, params};
}

export function buildCodexFollowupCommand(
    config: CodexProfile,
    sessionId: string
) {
    const {base, params} = buildCodexCommand(config);
    const follow = [...params, "resume", sessionId];
    return {base, params: follow};
}
