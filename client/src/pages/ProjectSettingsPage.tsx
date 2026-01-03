import {useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Bot, GitBranch, Github, Settings, Terminal, FolderGit2, Hash} from 'lucide-react'
import {useQueryClient} from '@tanstack/react-query'
import {PageHeader} from '@/components/layout/PageHeader'
import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {
    useAgents,
    useAgentProfiles,
    useProject,
    useProjectSettings,
    useProjectBranches,
    useUpdateProjectSettings,
} from '@/hooks'
import {agentKeys} from '@/lib/queryClient'
import {
    useProjectSettingsForm,
    buildProjectSettingsUpdate,
    type ProjectSettingsFormState,
} from '@/components/projects/ProjectSettingsPanel/useProjectSettingsForm'
import {BranchSettingsSection} from '@/components/projects/ProjectSettingsPanel/sections/BranchSettingsSection'
import {ScriptsSection} from '@/components/projects/ProjectSettingsPanel/sections/ScriptsSection'
import {AgentDefaultsSection} from '@/components/projects/ProjectSettingsPanel/sections/AgentDefaultsSection'
import {InlineAgentSection} from '@/components/projects/ProjectSettingsPanel/sections/InlineAgentSection'
import {PromptsSection} from '@/components/projects/ProjectSettingsPanel/sections/PromptsSection'
import {GithubIssueSyncSection} from '@/components/projects/ProjectSettingsPanel/sections/GithubIssueSyncSection'
import {TicketSettingsSection} from '@/components/projects/ProjectSettingsPanel/sections/TicketSettingsSection'

const SECTIONS: MasterDetailItem[] = [
    {id: 'general', label: 'General', icon: Settings},
    {id: 'git', label: 'Git', icon: GitBranch},
    {id: 'scripts', label: 'Scripts', icon: Terminal},
    {id: 'agents', label: 'Agents', icon: Bot},
    {id: 'github', label: 'GitHub', icon: Github},
]

type SectionId = (typeof SECTIONS)[number]['id']

function SectionHeader({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{className?: string}>
    title: string
    description: string
}) {
    return (
        <div className="mb-6 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-gradient-to-br from-muted/50 to-muted/20 shadow-sm">
                <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    )
}

function SettingsCard({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={`rounded-xl border border-border/40 bg-card/30 p-5 shadow-sm ${className}`}>
            {children}
        </div>
    )
}

export function ProjectSettingsPage() {
    const navigate = useNavigate()
    const params = useParams<{projectId: string}>()
    const projectId = params.projectId!
    const queryClient = useQueryClient()

    const [activeSection, setActiveSection] = useState<SectionId>('general')
    const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

    const {data: project} = useProject(projectId)
    const {data: settings, isLoading: settingsLoading, isError: settingsError} = useProjectSettings(projectId)
    const {data: branchesData, isLoading: branchesLoading} = useProjectBranches(projectId)
    const {data: agentsResponse, isLoading: agentsLoading} = useAgents()
    const {data: profileList, isLoading: profilesLoading} = useAgentProfiles('global')

    const branches = branchesData ?? []
    const agents = agentsResponse?.agents ?? []
    const profiles = useMemo(() => profileList ?? [], [profileList])

    const {
        form,
        setForm,
        isDirty,
        reset,
        initialSettings,
        nextTicketNumber,
        applySettings,
    } = useProjectSettingsForm(settings)

    const loading = settingsLoading || branchesLoading || agentsLoading || profilesLoading

    const updateForm = (patch: Partial<ProjectSettingsFormState>) => {
        setForm((prev) => ({...prev, ...patch}))
        setStatus('idle')
    }

    const refreshProfiles = async () => {
        await queryClient.invalidateQueries({
            queryKey: agentKeys.profiles('global'),
        })
    }

    const updateSettingsMutation = useUpdateProjectSettings({
        onSuccess: async (next) => {
            applySettings(next)
            setStatus('saved')
            await refreshProfiles()
        },
        onError: () => setStatus('error'),
    })

    const handleReset = () => {
        reset()
        setStatus('idle')
    }

    const handleSave = async () => {
        if (!initialSettings) return
        const updates = buildProjectSettingsUpdate(initialSettings, form)
        if (Object.keys(updates).length === 0) return
        await updateSettingsMutation.mutateAsync({projectId, updates})
    }

    if (settingsError) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4">
                <p className="text-sm text-destructive">Failed to load project settings</p>
                <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
                    Back to Board
                </Button>
            </div>
        )
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex h-64 items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                        <p className="text-sm text-muted-foreground">Loading settings...</p>
                    </div>
                </div>
            )
        }

        const contentWrapper = (children: React.ReactNode) => (
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                {children}
            </div>
        )

        switch (activeSection) {
            case 'general':
                return contentWrapper(
                    <div className="space-y-6">
                        <SectionHeader
                            icon={Settings}
                            title="General Settings"
                            description="Project information and ticket configuration"
                        />

                        <SettingsCard>
                            <div className="space-y-5">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    <FolderGit2 className="h-3.5 w-3.5" />
                                    <span>Project Details</span>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="space-y-2.5">
                                        <Label className="text-sm font-medium">Project Name</Label>
                                        <Input
                                            value={project?.name ?? ''}
                                            disabled
                                            className="h-10 bg-muted/40 font-medium text-muted-foreground"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Project names are immutable after creation.
                                        </p>
                                    </div>

                                    {project?.repositoryPath && (
                                        <div className="space-y-2.5">
                                            <Label className="text-sm font-medium">Repository Path</Label>
                                            <Input
                                                value={project.repositoryPath}
                                                disabled
                                                className="h-10 bg-muted/40 font-mono text-xs text-muted-foreground"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Linked git repository location.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SettingsCard>

                        <SettingsCard>
                            <div className="space-y-5">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    <Hash className="h-3.5 w-3.5" />
                                    <span>Ticket Numbering</span>
                                </div>

                                <TicketSettingsSection
                                    ticketPrefix={form.ticketPrefix}
                                    nextTicketNumber={nextTicketNumber}
                                    onPrefixChange={(value) => updateForm({ticketPrefix: value})}
                                />
                            </div>
                        </SettingsCard>
                    </div>
                )

            case 'git':
                return contentWrapper(
                    <div className="space-y-6">
                        <SectionHeader
                            icon={GitBranch}
                            title="Git & Version Control"
                            description="Branch defaults and automation settings"
                        />

                        <SettingsCard>
                            <BranchSettingsSection
                                baseBranch={form.baseBranch}
                                preferredRemote={form.preferredRemote}
                                autoCommitOnFinish={form.autoCommitOnFinish}
                                autoPushOnAutocommit={form.autoPushOnAutocommit}
                                branches={branches}
                                onChange={(patch) => updateForm(patch)}
                            />
                        </SettingsCard>
                    </div>
                )

            case 'scripts':
                return contentWrapper(
                    <div className="space-y-6">
                        <SectionHeader
                            icon={Terminal}
                            title="Scripts & Automation"
                            description="Configure scripts for worktree setup and cleanup"
                        />

                        <ScriptsSection
                            setupScript={form.setupScript}
                            devScript={form.devScript}
                            cleanupScript={form.cleanupScript}
                            copyFiles={form.copyFiles}
                            allowScriptsToFail={form.allowScriptsToFail}
                            allowCopyFilesToFail={form.allowCopyFilesToFail}
                            allowSetupScriptToFail={form.allowSetupScriptToFail}
                            allowDevScriptToFail={form.allowDevScriptToFail}
                            allowCleanupScriptToFail={form.allowCleanupScriptToFail}
                            onChange={(patch) => updateForm(patch)}
                        />
                    </div>
                )

            case 'agents':
                return contentWrapper(
                    <div className="space-y-6">
                        <SectionHeader
                            icon={Bot}
                            title="AI Agents"
                            description="Configure default agents for attempts and enhancements"
                        />

                        <SettingsCard>
                            <AgentDefaultsSection
                                defaultAgent={form.defaultAgent}
                                defaultProfileId={form.defaultProfileId}
                                agents={agents}
                                profiles={profiles}
                                onChange={(patch) => updateForm(patch)}
                            />
                        </SettingsCard>

                        <SettingsCard>
                            <InlineAgentSection
                                inlineAgent={form.inlineAgent}
                                inlineProfileId={form.inlineProfileId}
                                inlineAgentProfileMapping={form.inlineAgentProfileMapping}
                                agents={agents}
                                profiles={profiles}
                                onChange={(patch) => updateForm(patch)}
                            />
                        </SettingsCard>

                        <SettingsCard>
                            <PromptsSection
                                enhancePrompt={form.enhancePrompt}
                                prSummaryPrompt={form.prSummaryPrompt}
                                onChange={(patch) => updateForm(patch)}
                            />
                        </SettingsCard>
                    </div>
                )

            case 'github':
                return contentWrapper(
                    <div className="space-y-6">
                        <SectionHeader
                            icon={Github}
                            title="GitHub Integration"
                            description="Sync issues, create PRs, and automate workflows"
                        />

                        <SettingsCard>
                            <GithubIssueSyncSection
                                projectId={projectId}
                                boardId={project?.boardId ?? projectId}
                                githubIssueSyncEnabled={form.githubIssueSyncEnabled}
                                githubIssueSyncState={form.githubIssueSyncState}
                                githubIssueSyncIntervalMinutes={form.githubIssueSyncIntervalMinutes}
                                githubIssueAutoCreateEnabled={form.githubIssueAutoCreateEnabled}
                                autoCloseTicketOnPRMerge={form.autoCloseTicketOnPRMerge}
                                autoCloseTicketOnIssueClose={form.autoCloseTicketOnIssueClose}
                                onChange={(patch) => updateForm(patch)}
                            />
                        </SettingsCard>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <PageHeader
                title="Project Settings"
                description={project?.name ? `Configure settings for ${project.name}` : 'Loading...'}
                actions={
                    <>
                        {status === 'saved' && (
                            <Badge variant="secondary" className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Saved
                            </Badge>
                        )}
                        {status === 'error' && (
                            <Badge variant="outline" className="border-destructive/60 text-destructive">
                                Save failed
                            </Badge>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            disabled={!isDirty || updateSettingsMutation.isPending}
                        >
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!isDirty || updateSettingsMutation.isPending}
                        >
                            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </>
                }
            />

            <MasterDetailLayout
                title="Settings"
                items={SECTIONS}
                activeId={activeSection}
                onSelect={(id) => setActiveSection(id as SectionId)}
                loading={loading}
            >
                {renderContent()}
            </MasterDetailLayout>
        </div>
    )
}
