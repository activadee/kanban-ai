import type {OpencodeProfile} from "./schema";

const DEFAULT_BASE_COMMAND = "npx -y opencode-ai@0.11.1 run";

export function buildOpencodeCommand(config: OpencodeProfile) {
    const base = (config.baseCommandOverride?.trim() || DEFAULT_BASE_COMMAND) as string;
    const params: string[] = ["--print-logs", "--log-level", "ERROR"];

    if (config.agent) {
        params.push("--agent", config.agent);
    }

    if (config.model) {
        params.push("--model", config.model);
    }

    if (config.additionalParams?.length) {
        params.push(...config.additionalParams);
    }

    return {base, params};
}

export function buildOpencodeFollowupCommand(
    config: OpencodeProfile,
    sessionId: string
) {
    const {base, params} = buildOpencodeCommand(config);
    return {base, params: [...params, "--session", sessionId]};
}
