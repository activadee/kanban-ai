import {useMemo, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {ScrollArea} from '@/components/ui/scroll-area'
import {agentKeys} from '@/lib/queryClient'
import {
    useAgents,
    useAgentProfiles,
    useProject,
    useProjectSettings,
    useProjectBranches,
    useUpdateProjectSettings,
} from '@/hooks'
import type {ProjectSettings} from 'shared'
import {
    useProjectSettingsForm,
    buildProjectSettingsUpdate,
    type ProjectSettingsFormState,
} from '@/components/projects/ProjectSettingsPanel/useProjectSettingsForm'
import {BranchSettingsSection} from '@/components/projects/ProjectSettingsPanel/sections/BranchSettingsSection'
import {TicketSettingsSection} from '@/components/projects/ProjectSettingsPanel/sections/TicketSettingsSection'
import {ScriptsSection} from '@/components/projects/ProjectSettingsPanel/sections/ScriptsSection'
import {AgentDefaultsSection} from '@/components/projects/ProjectSettingsPanel/sections/AgentDefaultsSection'
import {InlineAgentSection} from '@/components/projects/ProjectSettingsPanel/sections/InlineAgentSection'
import {GithubIssueSyncSection} from '@/components/projects/ProjectSettingsPanel/sections/GithubIssueSyncSection'

type ProjectSettingsPanelProps = {
    projectId: string;
    onSaved?: (settings: ProjectSettings) => void;
    onClose?: () => void;
    scrollArea?: boolean;
}

export function ProjectSettingsPanel({
                                         projectId,
                                         onSaved,
                                         onClose,
                                         scrollArea = true,
                                     }: ProjectSettingsPanelProps) {
    const queryClient = useQueryClient()

    const {data: project} = useProject(projectId)

    const {
        data: settings,
        isLoading: settingsLoading,
        isError: settingsError,
        error: settingsErrorObj,
    } = useProjectSettings(projectId)

    const {
        data: branchesData,
        isLoading: branchesLoading,
        isError: branchesError,
        error: branchesErrorObj,
    } = useProjectBranches(projectId)
    const branches = branchesData ?? []

    const {
        data: agentsResponse,
        isLoading: agentsLoading,
        isError: agentsError,
        error: agentsErrorObj,
    } = useAgents()

    const {
        data: profileList,
        isLoading: profilesLoading,
        isError: profilesError,
        error: profilesErrorObj,
    } = useAgentProfiles('global')

    const {
        form,
        setForm,
        isDirty,
        reset,
        initialSettings,
        nextTicketNumber,
        applySettings,
    } = useProjectSettingsForm(settings)

    const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

    const agents = agentsResponse?.agents ?? []
    const profiles = useMemo(() => profileList ?? [], [profileList])

    const loading =
        settingsLoading || branchesLoading || agentsLoading || profilesLoading
    const error =
        settingsErrorObj ??
        branchesErrorObj ??
        agentsErrorObj ??
        profilesErrorObj ??
        (settingsError || branchesError || agentsError || profilesError
            ? new Error('Failed to load project settings')
            : null)

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
            onSaved?.(next)
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

    const body = (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Project Settings
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {project ? project.name : 'Loading…'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'saved' ? (
                        <Badge variant="secondary">Saved</Badge>
                    ) : status === 'error' ? (
                        <Badge
                            variant="outline"
                            className="border-destructive/60 text-destructive"
                        >
                            Save failed
                        </Badge>
                    ) : null}
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
                        {updateSettingsMutation.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ScrollArea className={scrollArea ? 'h-full' : undefined}>
                    <div className="space-y-6 px-6 py-4">
                        {loading ? (
                            <div className="text-sm text-muted-foreground">
                                Loading settings…
                            </div>
                        ) : error ? (
                            <div
                                className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                {error.message}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <BranchSettingsSection
                                    baseBranch={form.baseBranch}
                                    preferredRemote={form.preferredRemote}
                                    autoCommitOnFinish={form.autoCommitOnFinish}
                                    autoPushOnAutocommit={form.autoPushOnAutocommit}
                                    branches={branches}
                                    onChange={(patch) => updateForm(patch)}
                                />

                                <TicketSettingsSection
                                    ticketPrefix={form.ticketPrefix}
                                    nextTicketNumber={nextTicketNumber}
                                    onPrefixChange={(value) =>
                                        updateForm({ticketPrefix: value})
                                    }
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

                                <GithubIssueSyncSection
                                    projectId={projectId}
                                    boardId={project?.boardId ?? projectId}
                                    githubIssueSyncEnabled={form.githubIssueSyncEnabled}
                                    githubIssueSyncState={form.githubIssueSyncState}
                                    githubIssueSyncIntervalMinutes={form.githubIssueSyncIntervalMinutes}
                                    githubIssueAutoCreateEnabled={form.githubIssueAutoCreateEnabled}
                                    onChange={(patch) => updateForm(patch)}
                                />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {onClose ? (
                <div className="border-t border-border/60 px-4 py-3 text-right">
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            ) : null}
        </div>
    )

    return scrollArea ? body : <div className="flex h-full flex-col">{body}</div>
}
