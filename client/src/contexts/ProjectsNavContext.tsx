import {useMemo, useCallback} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import type {ProjectSummary} from 'shared'
import {useProjectsList, useDeleteProject} from '@/hooks'
import {projectsKeys} from '@/lib/queryClient'
import {ProjectsNavContext, type ProjectsNavContextValue} from './projectsNavContextCore'

export function ProjectsNavProvider({children}: { children: React.ReactNode }) {
    const queryClient = useQueryClient()

    const {data, isLoading, isError, error} = useProjectsList()

    const refresh = useCallback(() => queryClient.invalidateQueries({queryKey: projectsKeys.list()}), [queryClient])

    const upsertProject = useCallback((project: ProjectSummary) => {
        queryClient.setQueryData<ProjectSummary[]>(projectsKeys.list(), (prev = []) => {
            const index = prev.findIndex((item) => item.id === project.id)
            if (index === -1) return [project, ...prev]
            const next = [...prev]
            next[index] = project
            return next
        })
    }, [queryClient])

    const removeProject = useCallback((projectId: string) => {
        queryClient.setQueryData<ProjectSummary[]>(projectsKeys.list(), (prev = []) => prev.filter((project) => project.id !== projectId))
    }, [queryClient])

    const deleteMutation = useDeleteProject({
        onSuccess: (_data, projectId) => {
            removeProject(projectId)
        },
    })

    const value = useMemo<ProjectsNavContextValue>(
        () => ({
            projects: data ?? [],
            loading: isLoading,
            error: isError ? error?.message ?? 'Unable to load projects' : null,
            refresh,
            upsertProject,
            removeProject,
            deleteMutation,
        }),
        [data, isLoading, isError, error, refresh, upsertProject, removeProject, deleteMutation],
    )

    return <ProjectsNavContext.Provider value={value}>{children}</ProjectsNavContext.Provider>
}
