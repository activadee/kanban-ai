import type {DroidProfile} from './schema'

const DEFAULT_BASE = 'droid exec'

type DroidOutputFormat = 'json' | 'debug' | 'text'

export function buildDroidCommand(
    cfg: DroidProfile,
    prompt?: string,
    format: DroidOutputFormat = 'json',
) {
    const base = (cfg.baseCommandOverride?.trim() || DEFAULT_BASE) as string
    const params: string[] = ['-o', format]
    if (cfg.autonomy && cfg.autonomy !== 'read-only') params.push('--auto', cfg.autonomy)
    if (cfg.model) params.push('-m', cfg.model)
    if (cfg.reasoningEffort) params.push('-r', cfg.reasoningEffort)
    if (cfg.additionalParams?.length) params.push(...cfg.additionalParams)
    if (prompt) params.push(prompt)
    return {base, params, env: {NO_COLOR: '1', CLICOLOR: '0', CLICOLOR_FORCE: '0'}}
}

export function buildDroidFollowupCommand(
    cfg: DroidProfile,
    sessionId: string,
    followupPrompt?: string,
    format: DroidOutputFormat = 'json',
) {
    const {base, params, env} = buildDroidCommand(cfg, followupPrompt, format)
    return {base, params: [...params, '--session-id', sessionId], env}
}
