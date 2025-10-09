import {createContext} from 'react'
import type {ProjectSummary} from 'shared'
import type {UseMutationResult} from '@tanstack/react-query'

export type ProjectsNavContextValue = {
    projects: ProjectSummary[]
    loading: boolean
    error: string | null
    refresh: () => Promise<void> | void
    upsertProject: (project: ProjectSummary) => void
    removeProject: (projectId: string) => void
    deleteMutation: UseMutationResult<void, Error, string>
}

export const ProjectsNavContext = createContext<ProjectsNavContextValue | undefined>(undefined)
