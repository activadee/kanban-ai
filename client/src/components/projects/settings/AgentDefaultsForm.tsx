import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'

type Agent = { key: string; label: string }
type Profile = { id: string; name: string; agent: string }

export function AgentDefaultsForm({
                                      defaultAgent,
                                      defaultProfileId,
                                      agents,
                                      profiles,
                                      update,
                                  }: {
    defaultAgent: string
    defaultProfileId: string
    agents: Agent[]
    profiles: Profile[]
    update: (patch: Partial<{ defaultAgent: string; defaultProfileId: string }>) => void
}) {
    const NONE_VALUE = '__none__'
    const filtered = defaultAgent ? profiles.filter((p) => p.agent === defaultAgent) : profiles
    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Agent defaults</h3>
                <div className="text-xs text-muted-foreground">Choose defaults here; profiles are global.</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="default-agent">Primary agent</Label>
                    <Select
                        value={defaultAgent ? defaultAgent : NONE_VALUE}
                        onValueChange={(value) => {
                            if (value === NONE_VALUE) update({defaultAgent: '', defaultProfileId: ''})
                            else update({defaultAgent: value, defaultProfileId: ''})
                        }}
                    >
                        <SelectTrigger id="default-agent" className="w-full">
                            <SelectValue placeholder="Choose an agent"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value={NONE_VALUE}>
                                <div className="flex w-full items-center justify-between gap-2"><span>None</span></div>
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
                    <Label htmlFor="default-profile">Default profile</Label>
                    <Select
                        value={defaultProfileId ? defaultProfileId : NONE_VALUE}
                        onValueChange={(value) => update({defaultProfileId: value === NONE_VALUE ? '' : value})}
                        disabled={!defaultAgent || !filtered.length}
                    >
                        <SelectTrigger id="default-profile" className="w-full">
                            <SelectValue placeholder={defaultAgent ? 'Select profile' : 'Choose an agent first'}/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            <SelectItem value={NONE_VALUE}>
                                <div className="flex w-full items-center justify-between gap-2"><span>None</span></div>
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
                    {!filtered.length && defaultAgent ?
                        <p className="text-xs text-muted-foreground">No profiles found for {defaultAgent}. Create them
                            in Agents.</p> : null}
                </div>
            </div>
        </section>
    )
}

