import {useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {Bot, GitBranch, Github, Settings, Terminal} from 'lucide-react'
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
                    <p className="text-sm text-muted-foreground">Loading settings...</p>
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
                    <section className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">General Settings</h2>
                            <p className="text-sm text-muted-foreground">
                                Basic project information and ticket configuration
                            </p>
                        </div>

                        <div className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
                            <div className="space-y-2">
                                <Label>Project Name</Label>
                                <Input
                                    value={project?.name ?? ''}
                                    disabled
                                    className="bg-muted/50"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Project name cannot be changed
                                </p>
                            </div>

                            {project?.repositoryPath && (
                                <div className="space-y-2">
                                    <Label>Repository Path</Label>
                                    <Input
                                        value={project.repositoryPath}
                                        disabled
                                        className="bg-muted/50 font-mono text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        <TicketSettingsSection
                            ticketPrefix={form.ticketPrefix}
                            nextTicketNumber={nextTicketNumber}
                            onPrefixChange={(value) => updateForm({ticketPrefix: value})}
                        />
                    </section>
                )

            case 'git':
                return contentWrapper(
                    <section className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">Git & Version Control</h2>
                            <p className="text-sm text-muted-foreground">
                                Configure branch defaults and automation settings
                            </p>
                        </div>

                        <BranchSettingsSection
                            baseBranch={form.baseBranch}
                            preferredRemote={form.preferredRemote}
                            autoCommitOnFinish={form.autoCommitOnFinish}
                            autoPushOnAutocommit={form.autoPushOnAutocommit}
                            branches={branches}
                            onChange={(patch) => updateForm(patch)}
                        />
                    </section>
                )

            case 'scripts':
                return contentWrapper(
                    <section className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">Scripts & Automation</h2>
                            <p className="text-sm text-muted-foreground">
                                Configure scripts that run during worktree setup and cleanup
                            </p>
                        </div>

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
                    </section>
                )

            case 'agents':
                return contentWrapper(
                    <section className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">AI Agents</h2>
                            <p className="text-sm text-muted-foreground">
                                Configure default agents for new attempts and inline enhancements
                            </p>
                        </div>

                        <AgentDefaultsSection
                            defaultAgent={form.defaultAgent}
                            defaultProfileId={form.defaultProfileId}
                            agents={agents}
                            profiles={profiles}
                            onChange={(patch) => updateForm(patch)}
                        />

                        <InlineAgentSection
                            inlineAgent={form.inlineAgent}
                            inlineProfileId={form.inlineProfileId}
                            inlineAgentProfileMapping={form.inlineAgentProfileMapping}
                            agents={agents}
                            profiles={profiles}
                            onChange={(patch) => updateForm(patch)}
                        />
                    </section>
                )

            case 'github':
                return contentWrapper(
                    <section className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">GitHub Integration</h2>
                            <p className="text-sm text-muted-foreground">
                                Sync issues, create PRs, and automate workflows with GitHub
                            </p>
                        </div>

                        <GithubIssueSyncSection
                            projectId={projectId}
                            boardId={project?.boardId ?? projectId}
                            githubIssueSyncEnabled={form.githubIssueSyncEnabled}
                            githubIssueSyncState={form.githubIssueSyncState}
                            githubIssueSyncIntervalMinutes={form.githubIssueSyncIntervalMinutes}
                            githubIssueAutoCreateEnabled={form.githubIssueAutoCreateEnabled}
                            autoCloseTicketOnPRMerge={form.autoCloseTicketOnPRMerge}
                            onChange={(patch) => updateForm(patch)}
                        />
                    </section>
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
                            <Badge variant="secondary">Saved</Badge>
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
