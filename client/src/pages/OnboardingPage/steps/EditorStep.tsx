import {Separator} from '@/components/ui/separator'
import {EditorSettingsSection} from '../../app-settings/EditorSettingsSection'
import {GitDefaultsSection} from '../../app-settings/GitDefaultsSection'
import type {SettingsForm} from '../useOnboardingState'

export function EditorStep({
  settingsForm,
  editorValidationStatus,
  onChange,
}: {
  settingsForm: SettingsForm
  editorValidationStatus: 'valid' | 'invalid' | 'pending' | null
  onChange: (patch: Partial<SettingsForm>) => void
}) {
  return (
    <div className="space-y-6">
      <EditorSettingsSection
        editorCommand={settingsForm.editorCommand}
        validationStatus={editorValidationStatus}
        onChange={(v) => onChange({ editorCommand: v })}
      />
      <Separator />
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
