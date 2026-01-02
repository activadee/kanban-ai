import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'
import {Play, Bot, Sparkles} from 'lucide-react'
import type {AgentKey} from 'shared'
import {cn} from '@/lib/utils'

export function AttemptCreateForm({
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
    const isDisabled = starting || !agent || locked || blocked

    return (
        <div className={cn(
            "rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 p-4",
            "transition-all duration-200",
            !isDisabled && "hover:border-primary/30 hover:shadow-sm"
        )}>
            <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <h4 className="text-sm font-semibold tracking-tight">Create Attempt</h4>
                    <p className="text-[10px] text-muted-foreground">Select an agent to start working</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Agent
                        </Label>
                        <Select value={agent} onValueChange={(v) => onAgentChange(v as AgentKey)}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Choose agent" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                {agents.map((a) => (
                                    <SelectItem key={a.key} value={a.key}>
                                        <span className="flex items-center gap-2">
                                            <Sparkles className="h-3 w-3 text-muted-foreground" />
                                            {a.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {agent && availableProfiles.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Profile
                            </Label>
                            <Select
                                value={profileId ?? '__default__'}
                                onValueChange={(v) => onProfileChange(v === '__default__' ? undefined : v)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                    <SelectItem value="__default__">Default</SelectItem>
                                    {availableProfiles.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex w-full">
                                <Button
                                    onClick={onStart}
                                    disabled={isDisabled}
                                    className={cn(
                                        "w-full gap-2 transition-all",
                                        !isDisabled && "shadow-sm"
                                    )}
                                >
                                    <Play className="h-4 w-4" />
                                    {starting ? 'Starting...' : 'Start Attempt'}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {(locked || blocked) && (
                            <TooltipContent>
                                {locked ? 'This task is Done and locked.' : 'This task is blocked by dependencies.'}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    )
}
