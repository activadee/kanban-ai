import {Label} from '@/components/ui/label'
import {Checkbox} from '@/components/ui/checkbox'
import {Textarea} from '@/components/ui/textarea'

export type GithubForm = { ghAutolinkTickets: boolean; ghPrTitleTemplate: string; ghPrBodyTemplate: string }

export function GithubSettingsSection({form, onChange}: {
    form: GithubForm;
    onChange: (patch: Partial<GithubForm>) => void
}) {
    return (
        <section className="p-6">
            <div className="mb-4">
                <h2 className="text-base font-medium">GitHub</h2>
                <p className="text-sm text-muted-foreground">PR templates and linking behavior.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1"><Label htmlFor="autolink">Auto-link tickets</Label></div>
                <div className="sm:col-span-2 max-w-md flex items-center"><Checkbox id="autolink"
                                                                                    checked={form.ghAutolinkTickets}
                                                                                    onCheckedChange={(v) => onChange({ghAutolinkTickets: v === true})}/><span
                    className="ml-2 text-sm text-muted-foreground">Automatically add ticket key to the PR title.</span>
                </div>

                <div className="sm:col-span-1"><Label htmlFor="prTitle">PR title template</Label></div>
                <div className="sm:col-span-2 max-w-2xl"><Textarea id="prTitle" className="h-16"
                                                                   value={form.ghPrTitleTemplate}
                                                                   onChange={(e) => onChange({ghPrTitleTemplate: e.target.value})}
                                                                   placeholder="[{ticketKey}] {title}"/></div>

                <div className="sm:col-span-1"><Label htmlFor="prBody">PR body template</Label></div>
                <div className="sm:col-span-2 max-w-2xl"><Textarea id="prBody" className="h-32"
                                                                   value={form.ghPrBodyTemplate}
                                                                   onChange={(e) => onChange({ghPrBodyTemplate: e.target.value})}
                                                                   placeholder={"Changes on branch {branch} (attempt {attemptId})\n\n…"}/>
                </div>
            </div>
        </section>
    )
}

