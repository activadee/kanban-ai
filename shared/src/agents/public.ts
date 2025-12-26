// Public agent types shared between server and client

export type AgentSandbox = 'auto' | 'read-only' | 'workspace-write' | 'danger-full-access'

export type AgentSummary = {
    key: string
    label: string
    capabilities?: {
        resume?: boolean
        mcp?: boolean
        sandbox?: AgentSandbox
    }
}

export type AgentsListResponse = { agents: AgentSummary[] }

// DB row exposed by API for agent profiles (per project)
export type AgentProfileRow = {
    id: string
    projectId: string
    agent: string
    name: string
    configJson: string
    createdAt?: string
    updatedAt?: string
}

export type AgentProfileFieldBase = {
    key: string
    label: string
    optional: boolean
    nullable: boolean
    description?: string | null
}

export type AgentProfileField =
    | (AgentProfileFieldBase & { type: 'string' })
    | (AgentProfileFieldBase & { type: 'boolean' })
    | (AgentProfileFieldBase & { type: 'number' })
    | (AgentProfileFieldBase & { type: 'enum'; options: string[] })
    | (AgentProfileFieldBase & { type: 'string_array' })

export type AgentProfileSchemaResponse = {
    agent: string
    label: string
    defaultProfile: unknown
    fields: AgentProfileField[]
}
