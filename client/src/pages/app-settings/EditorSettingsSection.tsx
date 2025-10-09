import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import type {EditorType} from 'shared'

export function EditorSettingsSection({editorType, installed, onChange}: {
    editorType: EditorType | '';
    installed: Array<{ key: EditorType; label: string }>;
    onChange: (value: EditorType | '') => void
}) {
    return (
        <section className="p-6">
            <div className="mb-4">
                <h2 className="text-base font-medium">Editor</h2>
                <p className="text-sm text-muted-foreground">Configure the default editor used by the app.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1"><Label>Default editor</Label></div>
                <div className="sm:col-span-2 max-w-md">
                    <Select value={editorType || undefined} onValueChange={(v) => onChange(v as EditorType)}
                            disabled={!installed.length}>
                        <SelectTrigger><SelectValue placeholder="No editors detected"/></SelectTrigger>
                        <SelectContent>
                            {installed.map((editor) => (
                                <SelectItem key={editor.key} value={editor.key}>
                                    {editor.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!installed.length ? (
                        <p className="mt-2 text-xs text-muted-foreground">Install a supported editor to enable quick
                            open.</p>
                    ) : null}
                </div>
            </div>
        </section>
    )
}

