import {Separator} from '@/components/ui/separator'
import {EditorSettingsSection} from '../../app-settings/EditorSettingsSection'
import {GitDefaultsSection} from '../../app-settings/GitDefaultsSection'
import type {SettingsForm} from '../useOnboardingState'
import type {EditorType} from 'shared'

export function EditorStep({settingsForm, installedEditors, onChange}: {
    settingsForm: SettingsForm
    installedEditors: { key: EditorType; label: string }[]
    onChange: (patch: Partial<SettingsForm>) => void
}) {
    return (
        <div className="space-y-6">
            <EditorSettingsSection
                editorType={settingsForm.editorType}
                installed={installedEditors}
                onChange={(v) => onChange({editorType: v})}
            />
            <Separator/>
            <GitDefaultsSection
                form={{
                    gitUserName: settingsForm.gitUserName,
                    gitUserEmail: settingsForm.gitUserEmail,
                    branchTemplate: settingsForm.branchTemplate,
                }}
                onChange={(patch) => onChange(patch as Partial<SettingsForm>)}
            />
        </div>
    )
}

