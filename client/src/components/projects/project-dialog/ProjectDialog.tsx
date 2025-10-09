import {useCallback, useEffect, useState} from 'react'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import type {GitRepositoryEntry} from 'shared'
import type {Project} from '@/components/projects/ProjectCard'
import {useDiscoverGitRepositories} from '@/hooks'
import {ProjectTypeCard} from './ProjectTypeCard'
import {RepoList, type RepoEntry} from './RepoList'
import {ProjectForm} from './ProjectForm'
import {buildSuggestedPath, deriveSlugFromPath, normalizePathInput} from '@/lib/path'

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
    create: 'Create a project space and decide whether to initialize a new git repository or link an existing one.',
    edit: 'Update the project name to reflect its current scope. Repository path stays the same.',
}

export function ProjectDialog({open, mode, project, loading = false, onOpenChange, onSubmit}: ProjectDialogProps) {
    const [name, setName] = useState('')
    const [repository, setRepository] = useState('')
    const [modeChoice, setModeChoice] = useState<'existing' | 'blank'>('existing')
    const [view, setView] = useState<'choice' | 'repoList' | 'form'>('form')
    const [repositories, setRepositories] = useState<GitRepositoryEntry[]>([])
    const [repoLoading, setRepoLoading] = useState(false)
    const [repoError, setRepoError] = useState<string | null>(null)
    const [reposLoaded, setReposLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [blankEdited, setBlankEdited] = useState(false)

    useEffect(() => {
        if (!open) return
        const initialName = mode === 'edit' && project ? project.name : ''
        setName(initialName)
        if (mode === 'edit') {
            setModeChoice('existing')
            setRepository(project?.repositoryPath ?? '')
            setView('form')
        } else {
            setModeChoice('existing')
            setRepository('')
            setView('choice')
        }
        setError(null)
        setRepoError(null)
        setRepositories([])
        setReposLoaded(false)
        setBlankEdited(false)
    }, [open, mode, project])

    const repoMutation = useDiscoverGitRepositories({
        onSuccess: (entries) => {
            setRepositories(entries)
            setReposLoaded(true)
            if (!entries.length) setRepoError('No git repositories found yet. Try refreshing or enter a path manually.')
        },
        onError: () => {
            setRepoError('Unable to load repositories. You can browse manually.')
        },
        onSettled: () => setRepoLoading(false),
    })

    const loadRepositories = useCallback(async (path?: string) => {
        setRepoError(null)
        setRepoLoading(true)
        await repoMutation.mutateAsync({path})
    }, [repoMutation])

    useEffect(() => {
        if (open && mode === 'create' && view === 'repoList' && !repoLoading && !reposLoaded) {
            loadRepositories()
        }
    }, [open, mode, view, repoLoading, reposLoaded, loadRepositories])

    const manualEntry = useCallback(() => {
        setModeChoice('existing')
        setView('form')
        setRepoError(null)
    }, [])

    const handleRepoSelect = useCallback((entry: RepoEntry) => {
        setModeChoice('existing')
        setRepository(entry.path)
        setBlankEdited(false)
        if (!name.trim()) setName(entry.name || deriveSlugFromPath(entry.path))
        setView('form')
    }, [name])

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

    const placeholder = modeChoice === 'existing' ? 'e.g. /home/user/projects/sample-repo' : buildSuggestedPath(DEFAULT_BLANK_BASE, name)
    const showChoice = mode === 'create' && view === 'choice'
    const showRepoList = mode === 'create' && view === 'repoList'

    return (
        <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Create project' : 'Rename project'}</DialogTitle>
                    <DialogDescription>{descriptions[mode]}</DialogDescription>
                </DialogHeader>

                {showChoice ? (
                    <div className="grid gap-4">
                        <ProjectTypeCard
                            title="From Git Repository"
                            description="Use an existing repository as your project base"
                            icon="repo"
                            onClick={() => {
                                setModeChoice('existing')
                                setRepositories([])
                                setReposLoaded(false)
                                setView('repoList')
                                setError(null)
                                setBlankEdited(false)
                            }}
                        />
                        <ProjectTypeCard
                            title="Blank Project"
                            description="Start a new project from scratch"
                            icon="blank"
                            onClick={() => {
                                setModeChoice('blank')
                                const suggestion = buildSuggestedPath(DEFAULT_BLANK_BASE, name)
                                setRepository(suggestion)
                                setBlankEdited(false)
                                setView('form')
                                setError(null)
                            }}
                        />
                    </div>
                ) : showRepoList ? (
                    <RepoList
                        entries={repositories}
                        loading={repoLoading}
                        error={repoError}
                        onRefresh={() => loadRepositories()}
                        onManual={manualEntry}
                        onSelect={handleRepoSelect}
                    />
                ) : (
                    <ProjectForm
                        name={name}
                        repository={repository}
                        modeLabel={modeChoice === 'existing' ? 'From Git repository' : 'Blank project (git init)'}
                        placeholder={placeholder}
                        loading={loading}
                        error={error}
                        onNameChange={(next) => {
                            setName(next)
                            if (modeChoice === 'blank' && !blankEdited) setRepository(buildSuggestedPath(DEFAULT_BLANK_BASE, next))
                            if (error) setError(null)
                        }}
                        onRepositoryChange={(next) => {
                            setRepository(next)
                            if (modeChoice === 'blank') setBlankEdited(true)
                            if (error) setError(null)
                        }}
                        onBack={mode === 'create' ? () => setView('choice') : undefined}
                        onSubmit={handleSubmit}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
