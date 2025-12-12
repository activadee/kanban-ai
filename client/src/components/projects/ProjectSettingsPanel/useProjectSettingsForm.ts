import {useEffect, useMemo, useState} from 'react'
import type {InlineAgentProfileMapping, ProjectSettings} from 'shared'

export type ProjectSettingsFormState = {
    baseBranch: string;
    preferredRemote: string;
    setupScript: string;
    devScript: string;
    cleanupScript: string;
    copyFiles: string;
    allowScriptsToFail: boolean;
    allowCopyFilesToFail: boolean;
    allowSetupScriptToFail: boolean;
    allowDevScriptToFail: boolean;
    allowCleanupScriptToFail: boolean;
    defaultAgent: string;
    defaultProfileId: string;
    inlineAgent: string;
    inlineProfileId: string;
    inlineAgentProfileMapping: InlineAgentProfileMapping;
    autoCommitOnFinish: boolean;
    autoPushOnAutocommit: boolean;
    ticketPrefix: string;
    githubIssueSyncEnabled: boolean;
    githubIssueSyncState: 'open' | 'all' | 'closed';
    githubIssueSyncIntervalMinutes: number;
    githubIssueAutoCreateEnabled: boolean;
    autoCloseTicketOnPRMerge: boolean;
}

export function mapSettingsToForm(settings: ProjectSettings | null | undefined): ProjectSettingsFormState {
    if (!settings) {
        return {
            baseBranch: '',
            preferredRemote: '',
            setupScript: '',
            devScript: '',
            cleanupScript: '',
            copyFiles: '',
            allowScriptsToFail: false,
            allowCopyFilesToFail: false,
            allowSetupScriptToFail: false,
            allowDevScriptToFail: false,
            allowCleanupScriptToFail: false,
            defaultAgent: '',
            defaultProfileId: '',
            inlineAgent: '',
            inlineProfileId: '',
            inlineAgentProfileMapping: {},
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: '',
            githubIssueSyncEnabled: false,
            githubIssueSyncState: 'open',
            githubIssueSyncIntervalMinutes: 15,
            githubIssueAutoCreateEnabled: false,
            autoCloseTicketOnPRMerge: false,
        }
    }

    return {
        baseBranch: settings.baseBranch ?? '',
        preferredRemote: settings.preferredRemote ?? '',
        setupScript: settings.setupScript ?? '',
        devScript: settings.devScript ?? '',
        cleanupScript: settings.cleanupScript ?? '',
        copyFiles: settings.copyFiles ?? '',
        allowScriptsToFail: settings.allowScriptsToFail ?? false,
        allowCopyFilesToFail: settings.allowCopyFilesToFail ?? false,
        allowSetupScriptToFail: settings.allowSetupScriptToFail ?? false,
        allowDevScriptToFail: settings.allowDevScriptToFail ?? false,
        allowCleanupScriptToFail: settings.allowCleanupScriptToFail ?? false,
        defaultAgent: settings.defaultAgent ?? '',
        defaultProfileId: settings.defaultProfileId ?? '',
        inlineAgent: settings.inlineAgent ?? '',
        inlineProfileId: settings.inlineProfileId ?? '',
        inlineAgentProfileMapping: settings.inlineAgentProfileMapping ?? {},
        autoCommitOnFinish: settings.autoCommitOnFinish ?? false,
        autoPushOnAutocommit: settings.autoPushOnAutocommit ?? false,
        ticketPrefix: settings.ticketPrefix ?? '',
        githubIssueSyncEnabled: settings.githubIssueSyncEnabled ?? false,
        githubIssueSyncState: settings.githubIssueSyncState ?? 'open',
        githubIssueSyncIntervalMinutes: settings.githubIssueSyncIntervalMinutes ?? 15,
        githubIssueAutoCreateEnabled: settings.githubIssueAutoCreateEnabled ?? false,
        autoCloseTicketOnPRMerge: settings.autoCloseTicketOnPRMerge ?? false,
    }
}

export function buildProjectSettingsUpdate(initial: ProjectSettings | null, form: ProjectSettingsFormState): Partial<ProjectSettings> {
    const payload: Partial<ProjectSettings> = {}
    if (!initial) return payload

    if (form.baseBranch !== initial.baseBranch) {
        payload.baseBranch = form.baseBranch
    }
    if ((form.preferredRemote || '') !== (initial.preferredRemote ?? '')) {
        payload.preferredRemote = form.preferredRemote || null
    }
    if ((form.setupScript || '') !== (initial.setupScript ?? '')) {
        payload.setupScript = form.setupScript
    }
    if ((form.devScript || '') !== (initial.devScript ?? '')) {
        payload.devScript = form.devScript
    }
    if ((form.cleanupScript || '') !== (initial.cleanupScript ?? '')) {
        payload.cleanupScript = form.cleanupScript
    }
    if ((form.copyFiles || '') !== (initial.copyFiles ?? '')) {
        payload.copyFiles = form.copyFiles
    }
    if (
        form.allowScriptsToFail !== (initial.allowScriptsToFail ?? false)
    ) {
        payload.allowScriptsToFail = form.allowScriptsToFail
    }
    if (
        form.allowCopyFilesToFail !==
        (initial.allowCopyFilesToFail ?? false)
    ) {
        payload.allowCopyFilesToFail = form.allowCopyFilesToFail
    }
    if (
        form.allowSetupScriptToFail !==
        (initial.allowSetupScriptToFail ?? false)
    ) {
        payload.allowSetupScriptToFail = form.allowSetupScriptToFail
    }
    if (
        form.allowDevScriptToFail !==
        (initial.allowDevScriptToFail ?? false)
    ) {
        payload.allowDevScriptToFail = form.allowDevScriptToFail
    }
    if (
        form.allowCleanupScriptToFail !==
        (initial.allowCleanupScriptToFail ?? false)
    ) {
        payload.allowCleanupScriptToFail = form.allowCleanupScriptToFail
    }
    if ((form.defaultAgent || '') !== (initial.defaultAgent ?? '')) {
        payload.defaultAgent = form.defaultAgent || null
    }
    if ((form.defaultProfileId || '') !== (initial.defaultProfileId ?? '')) {
        payload.defaultProfileId = form.defaultProfileId || null
    }
    if ((form.inlineAgent || '') !== (initial.inlineAgent ?? '')) {
        payload.inlineAgent = form.inlineAgent || null
    }
    if ((form.inlineProfileId || '') !== (initial.inlineProfileId ?? '')) {
        payload.inlineProfileId = form.inlineProfileId || null
    }
    const initialMapping: InlineAgentProfileMapping =
        initial?.inlineAgentProfileMapping ?? {}
    const nextMapping = form.inlineAgentProfileMapping ?? {}
    if (JSON.stringify(initialMapping) !== JSON.stringify(nextMapping)) {
        payload.inlineAgentProfileMapping = nextMapping
    }
    if (form.autoCommitOnFinish !== (initial.autoCommitOnFinish ?? false)) {
        payload.autoCommitOnFinish = form.autoCommitOnFinish
    }
    if (form.autoPushOnAutocommit !== (initial.autoPushOnAutocommit ?? false)) {
        payload.autoPushOnAutocommit = form.autoPushOnAutocommit
    }
    if ((form.ticketPrefix || '') !== (initial.ticketPrefix ?? '')) {
        payload.ticketPrefix = form.ticketPrefix || initial.ticketPrefix
    }
    if (form.githubIssueSyncEnabled !== (initial.githubIssueSyncEnabled ?? false)) {
        payload.githubIssueSyncEnabled = form.githubIssueSyncEnabled
    }
    if ((form.githubIssueSyncState || 'open') !== (initial.githubIssueSyncState ?? 'open')) {
        payload.githubIssueSyncState = form.githubIssueSyncState
    }
    if ((form.githubIssueSyncIntervalMinutes || 15) !== (initial.githubIssueSyncIntervalMinutes ?? 15)) {
        payload.githubIssueSyncIntervalMinutes = form.githubIssueSyncIntervalMinutes
    }
    if (form.githubIssueAutoCreateEnabled !== (initial.githubIssueAutoCreateEnabled ?? false)) {
        payload.githubIssueAutoCreateEnabled = form.githubIssueAutoCreateEnabled
    }
    if (form.autoCloseTicketOnPRMerge !== (initial.autoCloseTicketOnPRMerge ?? false)) {
        payload.autoCloseTicketOnPRMerge = form.autoCloseTicketOnPRMerge
    }

    return payload
}

export function useProjectSettingsForm(settings: ProjectSettings | null | undefined) {
    const [initialSettings, setInitialSettings] = useState<ProjectSettings | null>(null)
    const [form, setForm] = useState<ProjectSettingsFormState>(() => mapSettingsToForm(null))

    useEffect(() => {
        if (settings) {
            setInitialSettings(settings)
            setForm(mapSettingsToForm(settings))
        }
    }, [settings])

    const isDirty = useMemo(() => {
        if (!initialSettings) return false
        const updates = buildProjectSettingsUpdate(initialSettings, form)
        return Object.keys(updates).length > 0
    }, [form, initialSettings])

    const reset = () => {
        if (initialSettings) {
            setForm(mapSettingsToForm(initialSettings))
        }
    }

    const applySettings = (next: ProjectSettings) => {
        setInitialSettings(next)
        setForm(mapSettingsToForm(next))
    }

    const nextTicketNumber = useMemo(() => {
        return (
            initialSettings?.nextTicketNumber ??
            settings?.nextTicketNumber ??
            1
        )
    }, [initialSettings, settings])

    return {
        form,
        setForm,
        isDirty,
        reset,
        initialSettings,
        nextTicketNumber,
        applySettings,
    }
}
