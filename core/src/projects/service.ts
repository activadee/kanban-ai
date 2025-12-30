import type {ProjectSummary, CreateProjectRequest, UpdateProjectRequest} from 'shared'
import {withRepoTx} from '../repos/provider'
import type {BoardRow} from '../db/types'
import {createDefaultBoardStructure} from '../tasks/service'
import {ensureGitRepository} from '../fs/git'
import {
    deleteBoard,
    getBoardById,
    listBoards,
    updateBoard,
    type BoardUpdate,
} from './repo'
import {deriveDefaultTicketPrefix} from './tickets/ticket-keys'
import {
    ensureProjectSettings,
    getProjectSettings,
    updateProjectSettings as saveProjectSettings
} from './settings/service'

function deriveSlugFromPath(path: string) {
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts.at(-1) ?? path
}

function mapBoardToProject(record: BoardRow): ProjectSummary {
    const createdAt =
        record.createdAt instanceof Date ? record.createdAt.toISOString() : new Date(record.createdAt).toISOString()

    return {
        id: record.id,
        boardId: record.id,
        name: record.name,
        status: 'Active',
        createdAt,
        repositoryPath: record.repositoryPath,
        repositoryUrl: record.repositoryUrl ?? null,
        repositorySlug: record.repositorySlug ?? null,
    }
}

async function listProjects(): Promise<ProjectSummary[]> {
    const rows = await listBoards()
    return rows.map(mapBoardToProject)
}

async function getProject(id: string): Promise<ProjectSummary | null> {
    const row = await getBoardById(id)
    return row ? mapBoardToProject(row) : null
}

async function createProject(input: CreateProjectRequest): Promise<ProjectSummary> {
    const id = crypto.randomUUID()
    const now = new Date()
    const name = input.name.trim()
    if (!name) {
        throw new Error('Project name is required')
    }

    const repositoryPath = await ensureGitRepository(input.repositoryPath, input.initialize === true)
    const repositorySlug = input.repositorySlug ?? deriveSlugFromPath(repositoryPath)
    const repositoryUrl = input.repositoryUrl ?? null
    const ticketPrefix = deriveDefaultTicketPrefix(name)

    await withRepoTx(async (provider) => {
        await provider.projects.insertBoard({
            id,
            name,
            repositoryPath,
            repositoryUrl,
            repositorySlug,
            createdAt: now,
            updatedAt: now,
        })

        await provider.projectSettings.insertProjectSettings({
            projectId: id,
            ticketPrefix,
            nextTicketNumber: 1,
            createdAt: now,
            updatedAt: now,
        })

        const defaultColumns = ['Backlog', 'In Progress', 'Review', 'Done']
        for (const [index, title] of defaultColumns.entries()) {
            await provider.projects.insertColumn({
                id: `col-${crypto.randomUUID()}`,
                boardId: id,
                title,
                order: index,
                createdAt: now,
                updatedAt: now,
            })
        }
    })

    await createDefaultBoardStructure(id)
    const project = await getProject(id)
    if (!project) {
        throw new Error('Failed to create project')
    }
    return project
}

async function updateProject(id: string, updates: UpdateProjectRequest): Promise<ProjectSummary | null> {
    const payload: BoardUpdate = {
        updatedAt: new Date(),
    }

    if (updates.name !== undefined) {
        const name = updates.name.trim()
        if (!name) {
            throw new Error('Project name cannot be empty')
        }
        payload.name = name
    }

    const fieldsToUpdate = Object.keys(payload)
    if (fieldsToUpdate.length <= 1 && payload.updatedAt) {
        return getProject(id)
    }

    await updateBoard(id, payload)
    return getProject(id)
}

async function deleteProject(id: string): Promise<boolean> {
    const existing = await getBoardById(id)
    if (!existing) return false
    await deleteBoard(id)
    return true
}

export const projectsService = {
    list: listProjects,
    get: getProject,
    create: createProject,
    update: updateProject,
    remove: deleteProject,
    ensureSettings: ensureProjectSettings,
    getSettings: getProjectSettings,
    updateSettings: saveProjectSettings,
}

export type ProjectsService = typeof projectsService
