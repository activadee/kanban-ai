import {Separator} from '@/components/ui/separator'
import {GithubSettingsSection} from '../../app-settings/GithubSettingsSection'
import {GithubAppCredentialsFields} from '@/components/github/GithubAppCredentialsFields'
import type {SettingsForm, CredentialsState} from '../useOnboardingState'
import type {Dispatch, SetStateAction} from 'react'

export function GitStep({settingsForm, appCredForm, setSettingsForm, setAppCredForm, savingAppConfig}: {
    settingsForm: SettingsForm
    appCredForm: CredentialsState | null
    setSettingsForm: (patch: Partial<SettingsForm>) => void
    setAppCredForm: Dispatch<SetStateAction<CredentialsState | null>>
    savingAppConfig: boolean
}) {
    return (
        <div className="space-y-6">
            <GithubSettingsSection
                form={{
                    ghAutolinkTickets: settingsForm.ghAutolinkTickets,
                    ghPrTitleTemplate: settingsForm.ghPrTitleTemplate,
                    ghPrBodyTemplate: settingsForm.ghPrBodyTemplate,
                }}
                onChange={setSettingsForm}
            />
            <Separator/>
            {appCredForm ? (
                <GithubAppCredentialsFields
                    value={appCredForm}
                    onChange={(patch) =>
                        setAppCredForm((prev) => {
                            const base = prev ?? appCredForm
                            const next = {
                                ...base,
                                ...patch,
                            }
                            return {
                                ...next,
                                secretAction:
                                    patch.clientSecret !== undefined
                                        ? 'update'
                                        : patch.secretAction ?? base.secretAction,
                            }
                        })
                    }
                    disabled={savingAppConfig}
                />
            ) : null}
        </div>
    )
}

