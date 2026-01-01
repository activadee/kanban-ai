import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Badge} from '@/components/ui/badge'
import {Github, Link2, FileText, Check} from 'lucide-react'
import {cn} from '@/lib/utils'

export type GithubForm = {ghAutolinkTickets: boolean; ghPrTitleTemplate: string; ghPrBodyTemplate: string}

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

const PR_TITLE_TOKENS = [
    {token: '{ticketKey}', description: 'Ticket ID'},
    {token: '{title}', description: 'Ticket title'},
    {token: '{type}', description: 'Ticket type'},
]

const PR_BODY_TOKENS = [
    {token: '{ticketKey}', description: 'Ticket ID'},
    {token: '{title}', description: 'Ticket title'},
    {token: '{description}', description: 'Ticket description'},
    {token: '{branch}', description: 'Branch name'},
    {token: '{attemptId}', description: 'Attempt ID'},
]

export function GithubSettingsSection({form, onChange}: {
    form: GithubForm;
    onChange: (patch: Partial<GithubForm>) => void
}) {
    return (
        <div className="space-y-6">
            <SectionHeader
                icon={Github}
                title="GitHub Integration"
                description="PR templates and ticket linking behavior"
            />

            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-r from-muted/20 via-background to-muted/20">
                <button
                    type="button"
                    onClick={() => onChange({ghAutolinkTickets: !form.ghAutolinkTickets})}
                    className="group relative flex w-full items-center gap-4 p-5 transition-colors hover:bg-muted/30"
                >
                    <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all',
                        form.ghAutolinkTickets
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                            : 'border-border/60 bg-muted/30 text-muted-foreground'
                    )}>
                        {form.ghAutolinkTickets ? (
                            <Check className="h-6 w-6" />
                        ) : (
                            <Link2 className="h-6 w-6" />
                        )}
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium">Auto-link tickets in PR title</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            Automatically prepend ticket key to PR titles when creating pull requests
                        </div>
                    </div>
                    <Badge
                        variant={form.ghAutolinkTickets ? 'default' : 'outline'}
                        className={cn(
                            'h-6 px-2.5 text-[10px]',
                            form.ghAutolinkTickets ? 'bg-emerald-500/90' : 'border-dashed'
                        )}
                    >
                        {form.ghAutolinkTickets ? 'ENABLED' : 'DISABLED'}
                    </Badge>
                </button>
            </div>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>PR Title Template</span>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="prTitle" className="text-sm font-medium">
                            Default title format for pull requests
                        </Label>
                        <Textarea
                            id="prTitle"
                            value={form.ghPrTitleTemplate}
                            onChange={(e) => onChange({ghPrTitleTemplate: e.target.value})}
                            placeholder="[{ticketKey}] {title}"
                            className="h-16 resize-none font-mono text-sm transition-all focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {PR_TITLE_TOKENS.map((item) => (
                                <button
                                    key={item.token}
                                    type="button"
                                    onClick={() => {
                                        const newValue = form.ghPrTitleTemplate 
                                            ? `${form.ghPrTitleTemplate}${item.token}` 
                                            : item.token
                                        onChange({ghPrTitleTemplate: newValue})
                                    }}
                                >
                                    <Badge
                                        variant="outline"
                                        className="gap-1 border-dashed px-2 py-0.5 font-mono text-[10px] transition-colors hover:border-primary/50 hover:bg-primary/5"
                                    >
                                        <code className="text-primary">{item.token}</code>
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard>
                <div className="space-y-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>PR Body Template</span>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="prBody" className="text-sm font-medium">
                            Default description for pull requests
                        </Label>
                        <Textarea
                            id="prBody"
                            value={form.ghPrBodyTemplate}
                            onChange={(e) => onChange({ghPrBodyTemplate: e.target.value})}
                            placeholder={"## Summary\n\nChanges on branch `{branch}` (attempt {attemptId})\n\n## Description\n\n{description}"}
                            className="h-40 resize-none font-mono text-sm transition-all focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {PR_BODY_TOKENS.map((item) => (
                                <button
                                    key={item.token}
                                    type="button"
                                    onClick={() => {
                                        const newValue = form.ghPrBodyTemplate 
                                            ? `${form.ghPrBodyTemplate}${item.token}` 
                                            : item.token
                                        onChange({ghPrBodyTemplate: newValue})
                                    }}
                                >
                                    <Badge
                                        variant="outline"
                                        className="gap-1 border-dashed px-2 py-0.5 font-mono text-[10px] transition-colors hover:border-primary/50 hover:bg-primary/5"
                                    >
                                        <code className="text-primary">{item.token}</code>
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
                    <div className="space-y-2">
                        <div className="rounded-md bg-muted/30 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</div>
                            <code className="font-mono text-sm text-foreground/80">
                                {(form.ghPrTitleTemplate || '[{ticketKey}] {title}')
                                    .replace('{ticketKey}', 'PROJ-123')
                                    .replace('{title}', 'Add user authentication')
                                    .replace('{type}', 'feature')}
                            </code>
                        </div>
                        <div className="rounded-md bg-muted/30 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Body (first line)</div>
                            <code className="font-mono text-sm text-foreground/80">
                                {(form.ghPrBodyTemplate || 'Changes on branch {branch}...')
                                    .split('\n')[0]
                                    .replace('{ticketKey}', 'PROJ-123')
                                    .replace('{title}', 'Add user authentication')
                                    .replace('{branch}', 'feature/PROJ-123-add-user-auth')
                                    .replace('{attemptId}', '1')
                                    .replace('{description}', '...')
                                    .slice(0, 60)}
                                {(form.ghPrBodyTemplate || '').length > 60 ? '...' : ''}
                            </code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
