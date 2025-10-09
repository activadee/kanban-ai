export type OpencodeProfile = {
    appendPrompt?: string | null
    agent?: string
    model?: string
    baseCommandOverride?: string | null
    additionalParams?: string[]
    debug?: boolean
}

export const defaultOpencodeProfile: OpencodeProfile = {
    debug: false,
}
