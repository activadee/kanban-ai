import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import type {AgentKey} from 'shared'

export function AttemptCreateForm({
                                      kind,
                                      agents,
                                      agent,
                                      onAgentChange,
                                      availableProfiles,
                                      profileId,
                                      onProfileChange,
                                      onStart,
                                      locked,
                                      blocked,
                                      starting,
                                  }: {
    kind: 'implementation' | 'planning'
    agents: Array<{ key: AgentKey; label: string }>
    agent: AgentKey
    onAgentChange: (key: AgentKey) => void
    availableProfiles: Array<{ id: string; name: string }>
    profileId?: string
    onProfileChange: (id: string | undefined) => void
    onStart: () => void
    locked?: boolean
    blocked?: boolean
    starting?: boolean
}) {
    const isPlanning = kind === 'planning'
    const blockedForMode = Boolean(blocked && kind === 'implementation')
    const title = isPlanning ? 'Create Planning Attempt' : 'Create Attempt'

    return (
        <div className="rounded-lg border border-border/60 p-3">
            <Label className="mb-2 block font-medium">{title}</Label>
            <div className="space-y-3">
                <div className="space-y-1">
                    <Label>Agent</Label>
                    <Select value={agent} onValueChange={(v) => onAgentChange(v as AgentKey)}>
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="Choose agent"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                            {agents.map((a) => (
                                <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {agent && (
                    <div className="space-y-1">
                        <Label>Profile</Label>
                        <Select value={profileId ?? '__default__'}
                                onValueChange={(v) => onProfileChange(v === '__default__' ? undefined : v)}>
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="DEFAULT"/>
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                <SelectItem value="__default__">DEFAULT</SelectItem>
                                {availableProfiles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                      size="sm"
                      onClick={onStart}
                      disabled={starting || !agent || locked || blockedForMode}
                  >
                    {starting ? 'Starting…' : isPlanning ? 'Start planning' : 'Start'}
                  </Button>
                </span>
                            </TooltipTrigger>
                            {(locked || blockedForMode) ? (
                                <TooltipContent>
                                    {locked ? 'This task is Done and locked.' : 'This task is blocked by dependencies.'}
                                </TooltipContent>
                            ) : null}
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    )
}
