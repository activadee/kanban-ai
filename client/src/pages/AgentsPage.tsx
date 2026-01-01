import {useMemo, useState} from 'react'
import {Bot, Pencil, Plus, Settings2, Sparkles, Trash2, Zap} from 'lucide-react'
import {useQueryClient} from '@tanstack/react-query'
import {PageHeader} from '@/components/layout/PageHeader'
import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Card} from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {ProfileFormDialog} from '@/components/agents/ProfileFormDialog'
import {
    useAgents,
    useAgentProfiles,
    useCreateAgentProfile,
    useUpdateAgentProfile,
    useDeleteAgentProfile,
} from '@/hooks'
import {agentKeys} from '@/lib/queryClient'
import type {AgentProfileRow} from 'shared'

export function AgentsPage() {
    const queryClient = useQueryClient()
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingProfile, setEditingProfile] = useState<AgentProfileRow | null>(null)
    const [deletingProfile, setDeletingProfile] = useState<AgentProfileRow | null>(null)

    const agentsQuery = useAgents()
    const profilesQuery = useAgentProfiles('global')

    const agents = agentsQuery.data?.agents ?? []
    const profiles = profilesQuery.data ?? []

    const activeAgent = selectedAgent ?? agents[0]?.key ?? null

    const profilesByAgent = useMemo(() => {
        const map: Record<string, AgentProfileRow[]> = {}
        for (const profile of profiles) {
            if (!map[profile.agent]) map[profile.agent] = []
            map[profile.agent].push(profile)
        }
        return map
    }, [profiles])

    const activeProfiles = activeAgent ? (profilesByAgent[activeAgent] ?? []) : []
    const activeAgentData = agents.find((a) => a.key === activeAgent)

    const agentItems: MasterDetailItem[] = useMemo(
        () =>
            agents.map((agent) => {
                const count = profilesByAgent[agent.key]?.length ?? 0
                return {
                    id: agent.key,
                    label: agent.label,
                    subtitle: `${count} profile${count !== 1 ? 's' : ''}`,
                    icon: Bot,
                }
            }),
        [agents, profilesByAgent]
    )

    const createMutation = useCreateAgentProfile({
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
            setDialogOpen(false)
        },
    })

    const updateMutation = useUpdateAgentProfile({
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
            setDialogOpen(false)
            setEditingProfile(null)
        },
    })

    const deleteMutation = useDeleteAgentProfile({
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
            setDeletingProfile(null)
        },
    })

    const handleSave = async (data: {name: string; config: unknown}) => {
        if (editingProfile) {
            await updateMutation.mutateAsync({
                profileId: editingProfile.id,
                payload: {name: data.name, config: data.config},
            })
        } else if (activeAgent) {
            await createMutation.mutateAsync({
                agent: activeAgent,
                name: data.name,
                config: data.config,
            })
        }
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <PageHeader
                title="Agents"
                description="Configure AI coding agents and manage their profiles"
            />

            <MasterDetailLayout
                title="Available Agents"
                items={agentItems}
                activeId={activeAgent}
                onSelect={setSelectedAgent}
                loading={agentsQuery.isLoading}
                emptyState={
                    <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
                        <Bot className="size-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No agents registered</p>
                    </div>
                }
            >
                {activeAgent && activeAgentData ? (
                    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                        <div className="mb-6 sm:mb-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10 sm:size-14">
                                        <Bot className="size-6 text-primary sm:size-7" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-semibold sm:text-2xl">{activeAgentData.label}</h1>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {activeAgentData.key}
                                            </Badge>
                                            {activeAgentData.capabilities?.resume && (
                                                <Badge variant="secondary" className="gap-1 text-xs">
                                                    <Zap className="size-3" />
                                                    Resume
                                                </Badge>
                                            )}
                                            {activeAgentData.capabilities?.mcp && (
                                                <Badge variant="secondary" className="gap-1 text-xs">
                                                    <Sparkles className="size-3" />
                                                    MCP
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button 
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                        setEditingProfile(null)
                                        setDialogOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 size-4" />
                                    New Profile
                                </Button>
                            </div>
                        </div>

                        <div>
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground sm:mb-4">
                                Profiles
                            </h2>

                            {activeProfiles.length === 0 ? (
                                <Card className="border-dashed">
                                    <div className="flex flex-col items-center justify-center py-8 text-center sm:py-12">
                                        <div className="mb-3 rounded-full bg-muted/50 p-3 sm:mb-4 sm:p-4">
                                            <Settings2 className="size-6 text-muted-foreground/60 sm:size-8" />
                                        </div>
                                        <h3 className="mb-1 font-semibold">No profiles yet</h3>
                                        <p className="mb-4 max-w-sm px-4 text-sm text-muted-foreground">
                                            Create your first profile to customize how {activeAgentData.label} behaves.
                                        </p>
                                        <Button variant="outline" onClick={() => {
                                            setEditingProfile(null)
                                            setDialogOpen(true)
                                        }}>
                                            <Plus className="mr-2 size-4" />
                                            Create Profile
                                        </Button>
                                    </div>
                                </Card>
                            ) : (
                                <div className="space-y-2 sm:space-y-3">
                                    {activeProfiles.map((profile) => (
                                        <Card
                                            key={profile.id}
                                            className="transition-all duration-150 hover:border-border hover:shadow-sm"
                                        >
                                            <div className="flex items-center justify-between p-3 sm:p-4">
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted/60 sm:size-10">
                                                        <Settings2 className="size-4 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{profile.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Updated {formatRelativeTime(profile.updatedAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setEditingProfile(profile)
                                                            setDialogOpen(true)
                                                        }}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setDeletingProfile(profile)}
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center p-8">
                        <div className="text-center">
                            <Bot className="mx-auto mb-4 size-12 text-muted-foreground/30" />
                            <p className="text-muted-foreground">Select an agent to view profiles</p>
                        </div>
                    </div>
                )}
            </MasterDetailLayout>

            <ProfileFormDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setEditingProfile(null)
                }}
                agentKey={activeAgent ?? ''}
                profile={editingProfile}
                onSave={handleSave}
                isSaving={createMutation.isPending || updateMutation.isPending}
            />

            <Dialog open={Boolean(deletingProfile)} onOpenChange={(open) => !open && setDeletingProfile(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Profile</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{deletingProfile?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setDeletingProfile(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deletingProfile && deleteMutation.mutate({profileId: deletingProfile.id})}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function formatRelativeTime(date: Date | string | number | undefined): string {
    if (!date) return 'unknown'
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
}
