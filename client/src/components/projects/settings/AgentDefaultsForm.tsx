import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'
import {Bot, Cpu, Layers} from 'lucide-react'

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
    const selectedAgent = agents.find(a => a.key === defaultAgent)
    const selectedProfile = profiles.find(p => p.id === defaultProfileId)

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                <span>Worktree Agent</span>
            </div>

            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                <div className="relative p-5">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/40 bg-background shadow-sm">
                            <Bot className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold">
                                    {selectedAgent?.label ?? 'No agent selected'}
                                </span>
                                {selectedAgent && (
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                        {selectedAgent.key}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {selectedProfile
                                    ? `Using "${selectedProfile.name}" profile`
                                    : selectedAgent
                                        ? 'No profile selected'
                                        : 'Select an agent to start new attempts'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="default-agent" className="text-sm font-medium">Primary Agent</Label>
                    </div>
                    <Select
                        value={defaultAgent ? defaultAgent : NONE_VALUE}
                        onValueChange={(value) => {
                            if (value === NONE_VALUE) update({defaultAgent: '', defaultProfileId: ''})
                            else update({defaultAgent: value, defaultProfileId: ''})
                        }}
                    >
                        <SelectTrigger id="default-agent" className="h-10 transition-all focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="Choose an agent" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            <SelectItem value={NONE_VALUE}>
                                <span className="text-muted-foreground">None</span>
                            </SelectItem>
                            {agents.map((agent) => (
                                <SelectItem key={agent.key} value={agent.key}>
                                    <div className="flex w-full items-center gap-2">
                                        <span>{agent.label}</span>
                                        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                                            {agent.key}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Default agent for new worktree attempts.
                    </p>
                </div>

                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="default-profile" className="text-sm font-medium">Default Profile</Label>
                    </div>
                    <Select
                        value={defaultProfileId ? defaultProfileId : NONE_VALUE}
                        onValueChange={(value) => update({defaultProfileId: value === NONE_VALUE ? '' : value})}
                        disabled={!defaultAgent || !filtered.length}
                    >
                        <SelectTrigger
                            id="default-profile"
                            className={`h-10 transition-all focus:ring-2 focus:ring-primary/20 ${
                                !defaultAgent ? 'cursor-not-allowed opacity-50' : ''
                            }`}
                        >
                            <SelectValue placeholder={defaultAgent ? 'Select profile' : 'Choose an agent first'} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            <SelectItem value={NONE_VALUE}>
                                <span className="text-muted-foreground">None (use agent default)</span>
                            </SelectItem>
                            {filtered.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                    <div className="flex w-full items-center gap-2">
                                        <span>{profile.name}</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px]">
                                            {profile.agent}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!filtered.length && defaultAgent ? (
                        <p className="text-xs text-amber-500">
                            No profiles for {defaultAgent}. Create one in Agents settings.
                        </p>
                    ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Configuration preset for the selected agent.
                        </p>
                    )}
                </div>
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    The primary agent runs in isolated git worktrees for each attempt. Profiles define
                    model settings, system prompts, and sandbox configurations.{' '}
                    <span className="font-medium text-foreground">
                        Manage profiles in the global Agents settings.
                    </span>
                </p>
            </div>
        </div>
    )
}
