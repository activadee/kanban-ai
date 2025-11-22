import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import type {GithubAppConfig} from 'shared'

type CredentialsForm = {
    clientId: string
    clientSecret: string
    hasClientSecret: boolean
    source: GithubAppConfig['source']
    updatedAt?: string | null
}

export function GithubAppCredentialsFields({
                                               value,
                                               onChange,
                                               disabled = false,
                                           }: {
    value: CredentialsForm
    onChange: (patch: Partial<CredentialsForm>) => void
    disabled?: boolean
}) {
    const sourceLabel =
        value.source === 'db'
            ? 'Stored in app database'
            : value.source === 'env'
                ? 'Loaded from server environment'
                : 'Not configured'

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">GitHub OAuth App</Label>
                <Badge variant="secondary" className="uppercase tracking-wide">
                    {sourceLabel}
                </Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="gh-client-id">Client ID</Label>
                    <Input
                        id="gh-client-id"
                        value={value.clientId}
                        disabled={disabled}
                        placeholder="gho_xxxxx"
                        onChange={(e) => onChange({clientId: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">Personal OAuth app client ID used for device flow.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gh-client-secret">Client secret</Label>
                    <Input
                        id="gh-client-secret"
                        type="password"
                        value={value.clientSecret}
                        disabled={disabled}
                        placeholder={value.hasClientSecret ? '••••••••••' : 'Paste client secret'}
                        onChange={(e) => onChange({clientSecret: e.target.value})}
                        className={cn(!value.clientSecret && value.hasClientSecret && 'font-mono')}
                    />
                    <p className="text-xs text-muted-foreground">
                        Stored securely in the local database. Updating will overwrite the previous secret.
                    </p>
                </div>
            </div>
            <div className="text-xs text-muted-foreground">
                {value.hasClientSecret
                    ? 'Secret is present.'
                    : 'Secret is missing — set it to enable GitHub device login.'}
                {value.updatedAt ? ` Updated ${new Date(value.updatedAt).toLocaleString()}.` : ''}
            </div>
        </div>
    )
}
