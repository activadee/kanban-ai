import {Label} from '@/components/ui/label'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Checkbox} from '@/components/ui/checkbox'

export type GeneralForm = {
    theme: 'system' | 'light' | 'dark'
    language: 'browser' | 'en' | 'ja'
    telemetryEnabled: boolean
    notificationsAgentCompletionSound: boolean
    notificationsDesktop: boolean
}

export function GeneralSettingsSection({form, onChange, onDesktopToggle}: {
    form: GeneralForm;
    onChange: (patch: Partial<GeneralForm>) => void;
    onDesktopToggle: (checked: boolean) => void
}) {
    return (
        <section className="p-6">
            <div className="mb-4">
                <h2 className="text-base font-medium">General</h2>
                <p className="text-sm text-muted-foreground">Theme, language and basic preferences.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1"><Label>Theme</Label></div>
                <div className="sm:col-span-2 max-w-md">
                    <Select value={form.theme} onValueChange={(v) => onChange({theme: v as GeneralForm['theme']})}>
                        <SelectTrigger><SelectValue placeholder="Theme"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="sm:col-span-1"><Label>Language</Label></div>
                <div className="sm:col-span-2 max-w-md">
                    <Select value={form.language}
                            onValueChange={(v) => onChange({language: v as GeneralForm['language']})}>
                        <SelectTrigger><SelectValue placeholder="Language"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="browser">Browser</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="ja">日本語</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="sm:col-span-1"><Label htmlFor="telemetry">Telemetry</Label></div>
                <div className="sm:col-span-2 max-w-md flex items-center"><Checkbox id="telemetry"
                                                                                    checked={form.telemetryEnabled}
                                                                                    onCheckedChange={(v) => onChange({telemetryEnabled: v === true})}/><span
                    className="ml-2 text-sm text-muted-foreground">Send anonymous usage data</span></div>

                <div className="sm:col-span-1"><Label htmlFor="agentCompletionSound">Agent completion sound</Label>
                </div>
                <div className="sm:col-span-2 max-w-md flex items-center"><Checkbox id="agentCompletionSound"
                                                                                    checked={form.notificationsAgentCompletionSound}
                                                                                    onCheckedChange={(v) => onChange({notificationsAgentCompletionSound: v === true})}/><span
                    className="ml-2 text-sm text-muted-foreground">Play a sound when an agent run finishes</span></div>

                <div className="sm:col-span-1"><Label htmlFor="desktopNotifs">Desktop notifications</Label></div>
                <div className="sm:col-span-2 max-w-md flex items-center"><Checkbox id="desktopNotifs"
                                                                                    checked={form.notificationsDesktop}
                                                                                    onCheckedChange={(v) => onDesktopToggle(v === true)}/><span
                    className="ml-2 text-sm text-muted-foreground">Allow desktop notifications</span></div>
            </div>
        </section>
    )
}

