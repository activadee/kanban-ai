import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'

export function ProjectForm({
                                name,
                                repository,
                                modeLabel,
                                placeholder,
                                loading,
                                error,
                                onNameChange,
                                onRepositoryChange,
                                onBack,
                                onSubmit,
                            }: {
    name: string
    repository: string
    modeLabel: string
    placeholder: string
    loading?: boolean
    error?: string | null
    onNameChange: (name: string) => void
    onRepositoryChange: (path: string) => void
    onBack?: () => void
    onSubmit: () => void
}) {
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
            }}
            className="space-y-4"
        >
            <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input id="project-name" value={name} onChange={(e) => onNameChange(e.target.value)}
                       placeholder="Ex. Kanban workspace" autoFocus disabled={loading}/>
            </div>

            <div className="space-y-2">
                <Label>Project type</Label>
                <div
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{modeLabel}</span>
                    {onBack ? (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onBack}>
                            Change
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="space-y-2">
                <Label
                    htmlFor="project-repository">{modeLabel === 'From Git repository' ? 'Repository path' : 'Workspace location'}</Label>
                <Input
                    id="project-repository"
                    value={repository}
                    onChange={(e) => onRepositoryChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                    {modeLabel === 'From Git repository'
                        ? 'Paste the local path to a git repository. We’ll verify it before creating the project.'
                        : 'We’ll create this directory (if needed) and run git init automatically.'}
                </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
                    Back
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Processing…' : 'Continue'}
                </Button>
            </div>
        </form>
    )
}

