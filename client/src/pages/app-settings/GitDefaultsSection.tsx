import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Badge} from '@/components/ui/badge'
import {GitBranch, User, Mail, Hash, Braces} from 'lucide-react'
import {cn} from '@/lib/utils'

export type GitDefaultsForm = {gitUserName: string; gitUserEmail: string; branchTemplate: string}

function SectionHeader({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{className?: string}>
    title: string
    description: string
}) {
    return (
        <div className="mb-6 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-gradient-to-br from-muted/50 to-muted/20 shadow-sm">
                <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    )
}

function SettingsCard({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('rounded-xl border border-border/40 bg-card/30 p-5 shadow-sm', className)}>
            {children}
        </div>
    )
}

const BRANCH_TOKENS = [
    {token: '{prefix}', description: 'feature, fix, etc.'},
    {token: '{ticketKey}', description: 'e.g., PROJ-123'},
    {token: '{slug}', description: 'Title as slug'},
    {token: '{type}', description: 'Ticket type'},
]

export function GitDefaultsSection({form, onChange}: {
    form: GitDefaultsForm;
    onChange: (patch: Partial<GitDefaultsForm>) => void
}) {
    return (
        <div className="space-y-6">
            <SectionHeader
                icon={GitBranch}
                title="Git Defaults"
                description="User identity and branch naming conventions for commits and worktrees"
            />

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>User Identity</span>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <Label htmlFor="gitName" className="text-sm font-medium">Name</Label>
                            </div>
                            <Input
                                id="gitName"
                                value={form.gitUserName}
                                onChange={(e) => onChange({gitUserName: e.target.value})}
                                placeholder="Your Name"
                                className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Used as the commit author name.
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <Label htmlFor="gitEmail" className="text-sm font-medium">Email</Label>
                            </div>
                            <Input
                                id="gitEmail"
                                type="email"
                                value={form.gitUserEmail}
                                onChange={(e) => onChange({gitUserEmail: e.target.value})}
                                placeholder="you@example.com"
                                className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                            />
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Used as the commit author email.
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Hash className="h-3.5 w-3.5" />
                        <span>Branch Template</span>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="branchTemplate" className="text-sm font-medium">
                            Naming pattern for new branches
                        </Label>
                        <Textarea
                            id="branchTemplate"
                            value={form.branchTemplate}
                            onChange={(e) => onChange({branchTemplate: e.target.value})}
                            placeholder="{prefix}/{ticketKey}-{slug}"
                            className="h-20 resize-none font-mono text-sm transition-all focus:ring-2 focus:ring-primary/20"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            <Braces className="h-3.5 w-3.5" />
                            <span>Available Tokens</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {BRANCH_TOKENS.map((item) => (
                                <button
                                    key={item.token}
                                    type="button"
                                    onClick={() => {
                                        const newValue = form.branchTemplate 
                                            ? `${form.branchTemplate}${item.token}` 
                                            : item.token
                                        onChange({branchTemplate: newValue})
                                    }}
                                    className="group"
                                >
                                    <Badge
                                        variant="outline"
                                        className="gap-1.5 border-dashed px-2.5 py-1 font-mono text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                                    >
                                        <code className="text-primary">{item.token}</code>
                                        <span className="text-muted-foreground">— {item.description}</span>
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <div className="space-y-3">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Preview
                    </div>
                    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <code className="font-mono text-sm text-foreground/80">
                            {form.branchTemplate
                                .replace('{prefix}', 'feature')
                                .replace('{ticketKey}', 'PROJ-123')
                                .replace('{slug}', 'add-user-authentication')
                                .replace('{type}', 'feature')
                            || 'feature/PROJ-123-add-user-authentication'}
                        </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Example branch name using the current template with sample values.
                    </p>
                </div>
            </div>
        </div>
    )
}
