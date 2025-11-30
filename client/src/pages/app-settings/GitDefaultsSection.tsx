import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'

export type GitDefaultsForm = { gitUserName: string; gitUserEmail: string; branchTemplate: string }

export function GitDefaultsSection({form, onChange}: {
    form: GitDefaultsForm;
    onChange: (patch: Partial<GitDefaultsForm>) => void
}) {
    return (
        <section className="p-6">
            <div className="mb-4">
                <h2 className="text-base font-medium">Git Defaults</h2>
                <p className="text-sm text-muted-foreground">Applied when creating commits and worktrees.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1"><Label htmlFor="gitName">User name</Label></div>
                <div className="sm:col-span-2 max-w-md"><Input id="gitName" value={form.gitUserName}
                                                               onChange={(e) => onChange({gitUserName: e.target.value})}/>
                </div>

                <div className="sm:col-span-1"><Label htmlFor="gitEmail">User email</Label></div>
                <div className="sm:col-span-2 max-w-md"><Input id="gitEmail" type="email" value={form.gitUserEmail}
                                                               onChange={(e) => onChange({gitUserEmail: e.target.value})}/>
                </div>

                <div className="sm:col-span-1"><Label htmlFor="branchT">Branch naming template</Label></div>
                <div className="sm:col-span-2 max-w-2xl">
                    <Textarea id="branchT" value={form.branchTemplate}
                              onChange={(e) => onChange({branchTemplate: e.target.value})} className="h-20"
                              placeholder="{prefix}/{ticketKey}-{slug}"/>
                    <p className="mt-1 text-xs text-muted-foreground">Supported
                        tokens: {`{prefix}`}, {`{ticketKey}`}, {`{slug}`}, {`{type}`}</p>
                </div>
            </div>
        </section>
    )
}
