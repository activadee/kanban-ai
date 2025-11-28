import {GeneralSettingsSection} from '../../app-settings/GeneralSettingsSection'
import type {SettingsForm} from '../useOnboardingState'

export function SettingsStep({settingsForm, onChange, onDesktopToggle}: {
    settingsForm: SettingsForm
    onChange: (patch: Partial<SettingsForm>) => void
    onDesktopToggle: (checked: boolean) => void
}) {
    return (
        <GeneralSettingsSection
            form={{
                theme: settingsForm.theme,
                language: settingsForm.language,
                telemetryEnabled: settingsForm.telemetryEnabled,
                notificationsAgentCompletionSound: settingsForm.notificationsAgentCompletionSound,
                notificationsDesktop: settingsForm.notificationsDesktop,
                autoStartAgentOnInProgress: settingsForm.autoStartAgentOnInProgress,
            }}
            onChange={onChange}
            onDesktopToggle={onDesktopToggle}
        />
    )
}
