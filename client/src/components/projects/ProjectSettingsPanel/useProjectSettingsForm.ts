import {useEffect, useMemo, useState} from 'react'
import type {ProjectSettings} from 'shared'

export type ProjectSettingsFormState = {
    baseBranch: string;
    preferredRemote: string;
    setupScript: string;
    devScript: string;
    cleanupScript: string;
    copyFiles: string;
    defaultAgent: string;
    defaultProfileId: string;
    inlineAgent: string;
    inlineProfileId: string;
    autoCommitOnFinish: boolean;
    autoPushOnAutocommit: boolean;
    ticketPrefix: string;
    githubIssueSyncEnabled: boolean;
    githubIssueSyncState: 'open' | 'all' | 'closed';
    githubIssueSyncIntervalMinutes: number;
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
            defaultAgent: '',
            defaultProfileId: '',
            inlineAgent: '',
            inlineProfileId: '',
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: '',
            githubIssueSyncEnabled: false,
            githubIssueSyncState: 'open',
            githubIssueSyncIntervalMinutes: 15,
        }
    }

    return {
        baseBranch: settings.baseBranch ?? '',
        preferredRemote: settings.preferredRemote ?? '',
        setupScript: settings.setupScript ?? '',
        devScript: settings.devScript ?? '',
        cleanupScript: settings.cleanupScript ?? '',
        copyFiles: settings.copyFiles ?? '',
        defaultAgent: settings.defaultAgent ?? '',
        defaultProfileId: settings.defaultProfileId ?? '',
        inlineAgent: settings.inlineAgent ?? '',
        inlineProfileId: settings.inlineProfileId ?? '',
        autoCommitOnFinish: settings.autoCommitOnFinish ?? false,
        autoPushOnAutocommit: settings.autoPushOnAutocommit ?? false,
        ticketPrefix: settings.ticketPrefix ?? '',
        githubIssueSyncEnabled: settings.githubIssueSyncEnabled ?? false,
        githubIssueSyncState: settings.githubIssueSyncState ?? 'open',
        githubIssueSyncIntervalMinutes: settings.githubIssueSyncIntervalMinutes ?? 15,
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
