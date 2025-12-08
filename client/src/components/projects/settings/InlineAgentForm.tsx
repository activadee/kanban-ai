import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'
import type {InlineAgentProfileMapping} from 'shared'

type Agent = { key: string; label: string }
type Profile = { id: string; name: string; agent: string }

export function InlineAgentForm({
                                    inlineAgent,
                                    inlineProfileId,
                                    inlineAgentProfileMapping,
                                    agents,
                                    profiles,
                                    update,
                                }: {
    inlineAgent: string
    inlineProfileId: string
    inlineAgentProfileMapping: InlineAgentProfileMapping
    agents: Agent[]
    profiles: Profile[]
    update: (patch: Partial<{
        inlineAgent: string;
        inlineProfileId: string;
        inlineAgentProfileMapping: InlineAgentProfileMapping;
    }>) => void
}) {
    const NONE_VALUE = '__none__'
    const INLINE_AGENT_IDS: Array<{ id: 'ticketEnhance' | 'prSummary'; label: string; description: string }> = [
        {
            id: 'ticketEnhance',
            label: 'Enhance Ticket',
            description: 'Used for ticket enhancement inline actions.',
        },
        {
            id: 'prSummary',
            label: 'PR Inline summary',
            description: 'Used for PR title/body suggestions in the Create PR dialog.',
        },
    ]
    const filtered = inlineAgent ? profiles.filter((p) => p.agent === inlineAgent) : profiles
    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Inline Agent</h3>
                <div className="text-xs text-muted-foreground">
                    Used for inline actions like ticket enhancement and PR summaries in the Create PR dialog.
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="inline-agent">Inline agent</Label>
                    <Select
                        value={inlineAgent ? inlineAgent : NONE_VALUE}
                        onValueChange={(value) => {
                            if (value === NONE_VALUE) update({inlineAgent: '', inlineProfileId: ''})
                            else update({inlineAgent: value, inlineProfileId: ''})
                        }}
                    >
                        <SelectTrigger id="inline-agent" className="w-full">
                            <SelectValue placeholder="Choose an agent"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value={NONE_VALUE}>
                                <div className="flex w-full items-center justify-between gap-2">
                                    <span>None</span>
                                </div>
                            </SelectItem>
                            {agents.map((agent) => (
                                <SelectItem key={agent.key} value={agent.key}>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span>{agent.label}</span>
                                        <Badge variant="outline">{agent.key}</Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="inline-profile">Inline profile</Label>
                    <Select
                        value={inlineProfileId ? inlineProfileId : NONE_VALUE}
                        onValueChange={(value) => update({inlineProfileId: value === NONE_VALUE ? '' : value})}
                        disabled={!inlineAgent || !filtered.length}
                    >
                        <SelectTrigger id="inline-profile" className="w-full">
                            <SelectValue
                                placeholder={inlineAgent ? 'Select profile' : 'Choose an agent first'}
                            />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value={NONE_VALUE}>
                                <div className="flex w-full items-center justify-between gap-2">
                                    <span>None</span>
                                </div>
                            </SelectItem>
                            {filtered.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span>{profile.name}</span>
                                        <Badge variant="secondary">{profile.agent}</Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!filtered.length && inlineAgent ? (
                        <p className="text-xs text-muted-foreground">
                            No profiles found for {inlineAgent}. Create them in Agents.
                        </p>
                    ) : null}
                </div>
            </div>
            <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-card/30 p-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                        Inline agents
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                        Override profiles per inline workflow. When unset, the inline agent or project
                        defaults are used.
                    </p>
                </div>
                <div className="space-y-2">
                    {INLINE_AGENT_IDS.map((inline) => {
                        const currentId = inlineAgentProfileMapping?.[inline.id] ?? null
                        const mappedProfile =
                            typeof currentId === 'string'
                                ? profiles.find((p) => p.id === currentId)
                                : undefined
                        const usesDefault = !currentId
                        return (
                            <div
                                key={inline.id}
                                className="flex flex-col gap-1 rounded-md border border-border/40 bg-background/60 p-2 text-xs"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                            {inline.label}
                                        </span>
                                        {usesDefault ? (
                                            <Badge variant="outline" className="border-dashed">
                                                Default profile
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">Custom profile</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={currentId ?? NONE_VALUE}
                                            onValueChange={(value) => {
                                                const next: InlineAgentProfileMapping = {
                                                    ...inlineAgentProfileMapping,
                                                }
                                                if (value === NONE_VALUE) {
                                                    next[inline.id] = null
                                                } else {
                                                    next[inline.id] = value
                                                }
                                                update({inlineAgentProfileMapping: next})
                                            }}
                                            disabled={!profiles.length}
                                        >
                                            <SelectTrigger className="h-7 w-56 px-2 py-1 text-xs">
                                                <SelectValue
                                                    placeholder="Use default profile"
                                                />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60 overflow-y-auto text-xs">
                                                <SelectItem value={NONE_VALUE}>
                                                    <div className="flex w-full items-center justify-between gap-2">
                                                        <span>Use default (global/inline)</span>
                                                    </div>
                                                </SelectItem>
                                                {profiles.map((profile) => (
                                                    <SelectItem
                                                        key={profile.id}
                                                        value={profile.id}
                                                    >
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <span>{profile.name}</span>
                                                            <Badge variant="secondary">
                                                                {profile.agent}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {inline.description}
                                    {mappedProfile
                                        ? ` Currently using "${mappedProfile.name}".`
                                        : usesDefault && inlineAgent
                                          ? ` Currently using the ${inlineAgent} inline or default profile.`
                                          : usesDefault
                                            ? ' Currently using the project default agent profile.'
                                            : null}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
            {!inlineAgent ? (
                <p className="text-xs text-muted-foreground">
                    When no inline agent is configured, inline features like ticket enhancement will be unavailable for
                    this project.
                </p>
            ) : null}
        </section>
    )
}
