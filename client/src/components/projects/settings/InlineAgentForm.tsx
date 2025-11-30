import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'

type Agent = { key: string; label: string }
type Profile = { id: string; name: string; agent: string }

export function InlineAgentForm({
                                    inlineAgent,
                                    inlineProfileId,
                                    agents,
                                    profiles,
                                    update,
                                }: {
    inlineAgent: string
    inlineProfileId: string
    agents: Agent[]
    profiles: Profile[]
    update: (patch: Partial<{ inlineAgent: string; inlineProfileId: string }>) => void
}) {
    const NONE_VALUE = '__none__'
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
            {!inlineAgent ? (
                <p className="text-xs text-muted-foreground">
                    When no inline agent is configured, inline features like ticket enhancement will be unavailable for
                    this project.
                </p>
            ) : null}
        </section>
    )
}
