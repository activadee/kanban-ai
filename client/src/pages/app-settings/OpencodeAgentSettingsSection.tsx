import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'

export type OpencodeAgentForm = { opencodePort: number }

const RESERVED_PORTS = [80, 443, 22, 25, 53, 110, 143, 993, 995, 3306, 5432, 6379, 8080, 8443]

export function isValidPort(port: number): boolean {
    return port >= 1 && port <= 65535 && !RESERVED_PORTS.includes(port)
}

export function OpencodeAgentSettingsSection({form, onChange}: {
    form: OpencodeAgentForm;
    onChange: (patch: Partial<OpencodeAgentForm>) => void
}) {
    const portValue = form.opencodePort
    const isValid = isValidPort(portValue)
    const error = portValue && !isValid ? 'Port must be 1-65535 and not a reserved port' : null

    return (
        <section className="p-6">
            <div className="mb-4">
                <h2 className="text-base font-medium">OpenCode Agent</h2>
                <p className="text-sm text-muted-foreground">OpenCode agent connection settings.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1"><Label htmlFor="opencodePort">Server Port</Label></div>
                <div className="sm:col-span-2 max-w-md">
                    <Input
                        id="opencodePort"
                        type="number"
                        min={1}
                        max={65535}
                        value={form.opencodePort}
                        onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            onChange({opencodePort: isNaN(val) ? 4097 : val})
                        }}
                        className={error ? 'border-red-500' : ''}
                    />
                    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                        Default: 4097. Reserved ports (80, 443, 22, 25, 53, 110, 143, 993, 995, 3306, 5432, 6379, 8080, 8443) are not allowed.
                    </p>
                </div>
            </div>
        </section>
    )
}
