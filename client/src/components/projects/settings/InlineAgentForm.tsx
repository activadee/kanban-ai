import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Badge} from '@/components/ui/badge'
import {Sparkles, Layers, FileText, GitPullRequest, ArrowRight} from 'lucide-react'
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
    const INLINE_WORKFLOWS: Array<{ id: 'ticketEnhance' | 'prSummary'; label: string; description: string; icon: React.ReactNode }> = [
        {
            id: 'ticketEnhance',
            label: 'Enhance Ticket',
            description: 'Expands ticket descriptions with AI suggestions',
            icon: <FileText className="h-4 w-4" />,
        },
        {
            id: 'prSummary',
            label: 'PR Summary',
            description: 'Generates PR title and body from changes',
            icon: <GitPullRequest className="h-4 w-4" />,
        },
    ]
    const filtered = inlineAgent ? profiles.filter((p) => p.agent === inlineAgent) : profiles
    const selectedAgent = agents.find(a => a.key === inlineAgent)

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Inline Enhancement Agent</span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="inline-agent" className="text-sm font-medium">Inline Agent</Label>
                    </div>
                    <Select
                        value={inlineAgent ? inlineAgent : NONE_VALUE}
                        onValueChange={(value) => {
                            if (value === NONE_VALUE) update({inlineAgent: '', inlineProfileId: ''})
                            else update({inlineAgent: value, inlineProfileId: ''})
                        }}
                    >
                        <SelectTrigger id="inline-agent" className="h-10 transition-all focus:ring-2 focus:ring-primary/20">
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
                        Powers ticket enhancement and PR summaries.
                    </p>
                </div>

                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="inline-profile" className="text-sm font-medium">Default Profile</Label>
                    </div>
                    <Select
                        value={inlineProfileId ? inlineProfileId : NONE_VALUE}
                        onValueChange={(value) => update({inlineProfileId: value === NONE_VALUE ? '' : value})}
                        disabled={!inlineAgent || !filtered.length}
                    >
                        <SelectTrigger
                            id="inline-profile"
                            className={`h-10 transition-all focus:ring-2 focus:ring-primary/20 ${
                                !inlineAgent ? 'cursor-not-allowed opacity-50' : ''
                            }`}
                        >
                            <SelectValue placeholder={inlineAgent ? 'Select profile' : 'Choose an agent first'} />
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
                    {!filtered.length && inlineAgent ? (
                        <p className="text-xs text-amber-500">
                            No profiles for {inlineAgent}. Create one in Agents settings.
                        </p>
                    ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Fallback profile for inline operations.
                        </p>
                    )}
                </div>
            </div>

            {!inlineAgent && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                        No inline agent configured. Ticket enhancement and PR summary features
                        will be unavailable for this project.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Workflow Overrides
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Custom profiles per workflow
                    </p>
                </div>

                <div className="space-y-3">
                    {INLINE_WORKFLOWS.map((workflow, idx) => {
                        const currentId = inlineAgentProfileMapping?.[workflow.id] ?? null
                        const mappedProfile = typeof currentId === 'string'
                            ? profiles.find((p) => p.id === currentId)
                            : undefined
                        const usesDefault = !currentId

                        return (
                            <div key={workflow.id}>
                                <div className="group relative overflow-hidden rounded-lg border border-border/40 bg-card/30 transition-all hover:border-border/60 hover:bg-card/50">
                                    <div className="flex items-center gap-4 p-4">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                                            usesDefault
                                                ? 'border-border/40 bg-muted/30 text-muted-foreground'
                                                : 'border-primary/30 bg-primary/5 text-primary'
                                        }`}>
                                            {workflow.icon}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{workflow.label}</span>
                                                <Badge
                                                    variant={usesDefault ? 'outline' : 'secondary'}
                                                    className={`h-5 text-[10px] ${usesDefault ? 'border-dashed' : ''}`}
                                                >
                                                    {usesDefault ? 'Default' : 'Custom'}
                                                </Badge>
                                            </div>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {workflow.description}
                                            </p>
                                        </div>

                                        <Select
                                            value={currentId ?? NONE_VALUE}
                                            onValueChange={(value) => {
                                                const next: InlineAgentProfileMapping = {...inlineAgentProfileMapping}
                                                if (value === NONE_VALUE) {
                                                    next[workflow.id] = null
                                                } else {
                                                    next[workflow.id] = value
                                                }
                                                update({inlineAgentProfileMapping: next})
                                            }}
                                            disabled={!profiles.length}
                                        >
                                            <SelectTrigger className="h-9 w-48 text-xs">
                                                <SelectValue placeholder="Use default" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                <SelectItem value={NONE_VALUE}>
                                                    <span className="text-muted-foreground">Use default profile</span>
                                                </SelectItem>
                                                {profiles.map((profile) => (
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
                                    </div>

                                    {mappedProfile && (
                                        <div className="border-t border-border/30 bg-muted/10 px-4 py-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <ArrowRight className="h-3 w-3" />
                                                <span>Using <span className="font-medium text-foreground">{mappedProfile.name}</span> ({mappedProfile.agent})</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {idx < INLINE_WORKFLOWS.length - 1 && (
                                    <div className="my-2 flex justify-center">
                                        <div className="h-2 w-px bg-border/40" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    Inline agents run quick, single-shot completions without worktrees.
                    Override profiles per workflow, or leave as default to use the inline
                    agent&apos;s profile. When no override is set, falls back to{' '}
                    {selectedAgent ? (
                        <span className="font-medium text-foreground">{selectedAgent.label}</span>
                    ) : (
                        'project defaults'
                    )}.
                </p>
            </div>
        </div>
    )
}
