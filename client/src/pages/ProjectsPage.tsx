import {useCallback, useEffect, useMemo, useState} from 'react'
import {useNavigate, useOutletContext} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {ProjectsLanding} from '@/components/projects/ProjectsLanding'
import type {Project} from '@/components/projects/ProjectCard'
import {ProjectDialog, type ProjectDialogValues} from '@/components/projects/ProjectDialog'
import {ProjectDeleteDialog} from '@/components/projects/ProjectDeleteDialog'
import {useProjectsNav} from '@/contexts/useProjectsNav'
import type {AppLayoutContext} from '@/components/layout/AppLayout'
import {useCreateProject, useUpdateProjectName, useDeleteProject} from '@/hooks'
import {projectsKeys} from '@/lib/queryClient'
import {describeApiError} from '@/api/http'

export function ProjectsPage() {
    const {projects: navProjects, loading: navLoading, error: navError, upsertProject, removeProject} = useProjectsNav()
    const [error, setError] = useState<string | null>(navError)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteProject, setDeleteProject] = useState<Project | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const navigate = useNavigate()
    const {registerOpenCreate} = useOutletContext<AppLayoutContext>()
    const queryClient = useQueryClient()
    const createProjectMutation = useCreateProject({
        onSuccess: (project) => {
            upsertProject(project)
            setError(null)
            setDialogOpen(false)
            navigate(`/projects/${project.id}`)
        },
        onError: (err: unknown) => {
            const {description} = describeApiError(err, 'Unable to create project. Please try again.')
            setError(description ?? 'Unable to create project. Please try again.')
        },
    })

    const updateProjectMutation = useUpdateProjectName({
        onSuccess: (project) => {
            upsertProject(project)
            setActiveProject(project)
            setError(null)
            setDialogOpen(false)
        },
        onError: (err: unknown) => {
            const {description} = describeApiError(err, 'Unable to update project. Please try again.')
            setError(description ?? 'Unable to update project. Please try again.')
        },
    })

    const deleteProjectMutation = useDeleteProject({
        onMutate: () => {
            setDeleteError(null)
        },
        onError: (err: Error | unknown) => {
            const {description} = describeApiError(err, 'Unable to delete project. Please try again.')
            setDeleteError(description ?? 'Unable to delete project. Please try again.')
        },
        onSuccess: async (_data, projectId) => {
            await queryClient.invalidateQueries({queryKey: projectsKeys.detail(projectId)})
            removeProject(projectId)
            setDeleteError(null)
            setDeleteOpen(false)
            setDeleteProject(null)
        },
    })

    useEffect(() => {
        setError(navError)
    }, [navError])

    const openCreateDialog = useCallback(() => {
        setDialogMode('create')
        setActiveProject(null)
        setDialogOpen(true)
    }, [])

    const openEditDialog = (project: Project) => {
        setDialogMode('edit')
        setActiveProject(project)
        setDialogOpen(true)
    }

    const openDeleteDialog = (project: Project) => {
        setDeleteProject(project)
        setDeleteError(null)
        setDeleteOpen(true)
    }

    const handleDialogSubmit = async ({
                                          name,
                                          repositoryPath,
                                          initialize,
                                          repositorySlug,
                                          repositoryUrl
                                      }: ProjectDialogValues) => {
        if (dialogMode === 'create') {
            await createProjectMutation.mutateAsync({
                name,
                repositoryPath,
                initialize,
                repositorySlug: repositorySlug ?? null,
                repositoryUrl: repositoryUrl ?? null,
            })
        } else if (dialogMode === 'edit') {
            if (!activeProject) {
                setError('No project selected')
                return
            }
            await updateProjectMutation.mutateAsync({projectId: activeProject.id, update: {name}})
        }
    }

    useEffect(() => {
        registerOpenCreate(() => openCreateDialog())
        return () => registerOpenCreate(null)
    }, [registerOpenCreate, openCreateDialog])

    const projects = useMemo(() => navProjects, [navProjects])

    return (
        <>
            <ProjectsLanding
                projects={projects}
                loading={navLoading}
                error={error}
                onSelect={(id) => navigate(`/projects/${id}`)}
                onCreate={openCreateDialog}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
            />
            <ProjectDialog
                open={dialogOpen}
                mode={dialogMode}
                project={activeProject}
                loading={createProjectMutation.isPending || updateProjectMutation.isPending}
                onOpenChange={(next) => {
                    setDialogOpen(next)
                }}
                onSubmit={handleDialogSubmit}
            />
            <ProjectDeleteDialog
                open={deleteOpen}
                project={deleteProject}
                loading={deleteProjectMutation.isPending}
                errorMessage={deleteError}
                onOpenChange={(next) => {
                    setDeleteOpen(next)
                    if (!next) {
                        setDeleteError(null)
                    }
                }}
                onConfirm={async () => {
                    if (!deleteProject) return
                    await deleteProjectMutation.mutateAsync(deleteProject.id)
                }}
            />
        </>
    )
}
