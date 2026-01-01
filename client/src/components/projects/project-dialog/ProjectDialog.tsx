import {useCallback, useEffect, useState, useMemo} from 'react'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {FolderGit, FolderPlus, ChevronDown, Loader2, Check, AlertCircle, RefreshCw, Search} from 'lucide-react'
import type {GitRepositoryEntry} from 'shared'
import type {Project} from '@/components/projects/ProjectCard'
import {useDiscoverGitRepositories} from '@/hooks'
import {buildSuggestedPath, deriveSlugFromPath, normalizePathInput} from '@/lib/path'
import {cn} from '@/lib/utils'

const DEFAULT_BLANK_BASE = '~/kanbanai-projects'

export type ProjectDialogValues = {
    name: string
    repositoryPath: string
    repositorySlug?: string | null
    repositoryUrl?: string | null
    initialize?: boolean
}

type ProjectDialogProps = {
    open: boolean
    mode: 'create' | 'edit'
    project?: Project | null
    loading?: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (values: ProjectDialogValues) => Promise<void> | void
}

const descriptions: Record<ProjectDialogProps['mode'], string> = {
    create: 'Set up a new project workspace linked to a git repository.',
    edit: 'Update project details. Repository path cannot be changed.',
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid'

export function ProjectDialog({open, mode, project, loading = false, onOpenChange, onSubmit}: ProjectDialogProps) {
    const [name, setName] = useState('')
    const [repository, setRepository] = useState('')
    const [modeChoice, setModeChoice] = useState<'existing' | 'blank'>('existing')
    const [repositories, setRepositories] = useState<GitRepositoryEntry[]>([])
    const [repoLoading, setRepoLoading] = useState(false)
    const [repoError, setRepoError] = useState<string | null>(null)
    const [reposLoaded, setReposLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [blankEdited, setBlankEdited] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [pathValidation, setPathValidation] = useState<ValidationState>('idle')

    const filteredRepos = useMemo(() => {
        if (!searchQuery.trim()) return repositories
        const q = searchQuery.toLowerCase()
        return repositories.filter(r =>
            r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
        )
    }, [repositories, searchQuery])

    useEffect(() => {
        if (!open) return
        const initialName = mode === 'edit' && project ? project.name : ''
        setName(initialName)
        if (mode === 'edit') {
            setModeChoice('existing')
            setRepository(project?.repositoryPath ?? '')
            setPathValidation('valid')
        } else {
            setModeChoice('existing')
            setRepository('')
            setPathValidation('idle')
        }
        setError(null)
        setRepoError(null)
        setRepositories([])
        setReposLoaded(false)
        setBlankEdited(false)
        setPickerOpen(false)
        setSearchQuery('')
    }, [open, mode, project])

    const repoMutation = useDiscoverGitRepositories({
        onSuccess: (entries) => {
            setRepositories(entries)
            setReposLoaded(true)
            if (!entries.length) setRepoError('No repositories found. Enter a path manually.')
        },
        onError: () => {
            setRepoError('Unable to scan repositories.')
        },
        onSettled: () => setRepoLoading(false),
    })

    const loadRepositories = useCallback(async (path?: string) => {
        setRepoError(null)
        setRepoLoading(true)
        await repoMutation.mutateAsync({path})
    }, [repoMutation])

    useEffect(() => {
        if (open && mode === 'create' && pickerOpen && !repoLoading && !reposLoaded) {
            loadRepositories()
        }
    }, [open, mode, pickerOpen, repoLoading, reposLoaded, loadRepositories])

    useEffect(() => {
        if (mode === 'edit') return
        if (!repository.trim()) {
            setPathValidation('idle')
            return
        }

        if (modeChoice === 'blank') {
            setPathValidation('valid')
            return
        }

        setPathValidation('validating')
        const timer = setTimeout(() => {
            const normalized = normalizePathInput(repository)
            if (normalized && (normalized.startsWith('/') || normalized.startsWith('~'))) {
                setPathValidation('valid')
            } else {
                setPathValidation('invalid')
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [repository, modeChoice, mode])

    const handleRepoSelect = useCallback((entry: GitRepositoryEntry) => {
        setRepository(entry.path)
        setBlankEdited(false)
        if (!name.trim()) setName(entry.name || deriveSlugFromPath(entry.path))
        setPickerOpen(false)
        setSearchQuery('')
        setPathValidation('valid')
    }, [name])

    const handleModeChange = useCallback((newMode: 'existing' | 'blank') => {
        setModeChoice(newMode)
        setError(null)
        if (newMode === 'blank') {
            const suggestion = buildSuggestedPath(DEFAULT_BLANK_BASE, name)
            setRepository(suggestion)
            setBlankEdited(false)
            setPickerOpen(false)
        } else {
            if (!blankEdited) setRepository('')
            setPathValidation('idle')
        }
    }, [name, blankEdited])

    const handleSubmit = async () => {
        const trimmedName = name.trim()
        if (!trimmedName) {
            setError('Project name is required.')
            return
        }
        const trimmedRepository = normalizePathInput(repository)
        if (!trimmedRepository) {
            setError('Repository path is required.')
            return
        }
        try {
            const payload: ProjectDialogValues = {
                name: trimmedName,
                repositoryPath: trimmedRepository,
                repositorySlug: deriveSlugFromPath(trimmedRepository),
                initialize: mode === 'create' ? modeChoice === 'blank' : undefined,
            }
            await onSubmit(payload)
        } catch {
            setError('Something went wrong. Please try again.')
        }
    }

    const placeholder = modeChoice === 'existing'
        ? '/home/user/projects/my-repo'
        : buildSuggestedPath(DEFAULT_BLANK_BASE, name || 'my-project')

    const isEditMode = mode === 'edit'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit project' : 'Create project'}</DialogTitle>
                    <DialogDescription>{descriptions[mode]}</DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleSubmit()
                    }}
                    className="space-y-5"
                >
                    {!isEditMode && (
                        <div className="flex items-center justify-between gap-4">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">Project type</Label>
                            <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1">
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('existing')}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                        modeChoice === 'existing'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <FolderGit className="size-4"/>
                                    From Repository
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeChange('blank')}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                                        modeChoice === 'blank'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <FolderPlus className="size-4"/>
                                    Blank Project
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="project-name">Project name</Label>
                        <Input
                            id="project-name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                if (modeChoice === 'blank' && !blankEdited) {
                                    setRepository(buildSuggestedPath(DEFAULT_BLANK_BASE, e.target.value))
                                }
                                if (error) setError(null)
                            }}
                            placeholder="My awesome project"
                            autoFocus
                            disabled={loading}
                            className="focus-visible:ring-brand"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="project-repository">
                                {modeChoice === 'existing' ? 'Repository path' : 'Workspace location'}
                            </Label>
                            {modeChoice === 'existing' && !isEditMode && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPickerOpen(!pickerOpen)}
                                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Browse
                                    <ChevronDown className={cn(
                                        'size-3 transition-transform',
                                        pickerOpen && 'rotate-180'
                                    )}/>
                                </Button>
                            )}
                        </div>

                        {modeChoice === 'existing' && !isEditMode && pickerOpen && (
                            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search repositories..."
                                            className="h-8 pl-8 text-sm"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => loadRepositories()}
                                        disabled={repoLoading}
                                        className="h-8 w-8 p-0"
                                    >
                                        <RefreshCw className={cn('size-4', repoLoading && 'animate-spin')}/>
                                    </Button>
                                </div>

                                <div className="max-h-[200px] space-y-1.5 overflow-y-auto">
                                    {repoLoading && !reposLoaded ? (
                                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin"/>
                                            Scanning...
                                        </div>
                                    ) : repoError && filteredRepos.length === 0 ? (
                                        <div className="py-4 text-center text-sm text-muted-foreground">
                                            {repoError}
                                        </div>
                                    ) : filteredRepos.length === 0 ? (
                                        <div className="py-4 text-center text-sm text-muted-foreground">
                                            {searchQuery ? 'No matching repositories' : 'No repositories found'}
                                        </div>
                                    ) : (
                                        filteredRepos.slice(0, 8).map((entry) => (
                                            <button
                                                key={entry.path}
                                                type="button"
                                                onClick={() => handleRepoSelect(entry)}
                                                className={cn(
                                                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                                                    'hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand',
                                                    repository === entry.path && 'bg-brand/10 text-brand'
                                                )}
                                            >
                                                <FolderGit className="size-4 shrink-0 text-muted-foreground"/>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block font-medium truncate">{entry.name}</span>
                                                    <span className="block text-xs text-muted-foreground truncate">
                                                        {entry.path}
                                                    </span>
                                                </span>
                                                {repository === entry.path && (
                                                    <Check className="size-4 text-brand"/>
                                                )}
                                            </button>
                                        ))
                                    )}
                                    {filteredRepos.length > 8 && (
                                        <p className="py-2 text-center text-xs text-muted-foreground">
                                            +{filteredRepos.length - 8} more repositories
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <Input
                                id="project-repository"
                                value={repository}
                                onChange={(e) => {
                                    setRepository(e.target.value)
                                    if (modeChoice === 'blank') setBlankEdited(true)
                                    if (error) setError(null)
                                }}
                                placeholder={placeholder}
                                disabled={loading || isEditMode}
                                className={cn(
                                    'pr-9 font-mono text-sm focus-visible:ring-brand',
                                    pathValidation === 'valid' && 'border-green-500/50',
                                    pathValidation === 'invalid' && 'border-destructive/50'
                                )}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {pathValidation === 'validating' && (
                                    <Loader2 className="size-4 animate-spin text-muted-foreground"/>
                                )}
                                {pathValidation === 'valid' && (
                                    <Check className="size-4 text-green-500"/>
                                )}
                                {pathValidation === 'invalid' && (
                                    <AlertCircle className="size-4 text-destructive"/>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            {modeChoice === 'existing'
                                ? 'Path to an existing git repository on your machine.'
                                : 'Directory will be created with git init if it doesn\'t exist.'}
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="size-4 shrink-0"/>
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || (pathValidation !== 'valid' && pathValidation !== 'idle' && !isEditMode)}
                            className="bg-brand text-brand-foreground hover:bg-brand/90"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin"/>
                                    {isEditMode ? 'Saving...' : 'Creating...'}
                                </>
                            ) : (
                                isEditMode ? 'Save changes' : 'Create project'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
