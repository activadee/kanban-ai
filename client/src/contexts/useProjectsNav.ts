import {useContext} from 'react'
import {ProjectsNavContext, type ProjectsNavContextValue} from './projectsNavContextCore'

export function useProjectsNav(): ProjectsNavContextValue {
    const ctx = useContext(ProjectsNavContext)
    if (!ctx) throw new Error('useProjectsNav must be used within ProjectsNavProvider')
    return ctx
}

