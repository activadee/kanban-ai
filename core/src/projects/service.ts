import type {ProjectSummary, CreateProjectRequest, UpdateProjectRequest} from 'shared'
import {withTx, type DbExecutor} from '../db/with-tx'
import type {Board} from '../db/schema'
import {createDefaultBoardStructure} from '../tasks/service'
import {ensureGitRepository} from '../fs/git'
import {
    deleteBoard,
    getBoardById,
    insertBoard,
    insertColumn,
    listBoards,
    updateBoard,
    type BoardUpdate,
} from './repo'
import {deriveDefaultTicketPrefix} from './tickets/ticket-keys'
import {insertProjectSettings} from './settings/repo'
import {
    ensureProjectSettings,
    getProjectSettings,
    updateProjectSettings as saveProjectSettings
} from './settings/service'

function deriveSlugFromPath(path: string) {
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts.at(-1) ?? path
}

function mapBoardToProject(record: Board): ProjectSummary {
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

async function listProjects(executor?: DbExecutor): Promise<ProjectSummary[]> {
    const rows = await listBoards(executor)
    return rows.map(mapBoardToProject)
}

async function getProject(id: string, executor?: DbExecutor): Promise<ProjectSummary | null> {
    const row = await getBoardById(id, executor)
    return row ? mapBoardToProject(row) : null
}

async function createProject(input: CreateProjectRequest, executor?: DbExecutor): Promise<ProjectSummary> {
    const id = crypto.randomUUID()
    const now = new Date()
    const name = input.name.trim()
    if (!name) {
        throw new Error('Project name is required')
    }

    const repositoryPath = await ensureGitRepository(input.repositoryPath, input.initialize === true)
    const repositorySlug = input.repositorySlug ?? deriveSlugFromPath(repositoryPath)
    const repositoryUrl = input.repositoryUrl ?? null

    const run = async (tx: DbExecutor) => {
        const ticketPrefix = deriveDefaultTicketPrefix(name)
        await insertBoard(
            {
                id,
                name,
                repositoryPath,
                repositoryUrl,
                repositorySlug,
                createdAt: now,
                updatedAt: now,
            },
            tx,
        )

        await insertProjectSettings(
            {
                projectId: id,
                ticketPrefix,
                nextTicketNumber: 1,
                createdAt: now,
                updatedAt: now,
            },
            tx,
        )

        const defaultColumns = ['Backlog', 'In Progress', 'Review', 'Done']
        for (const [index, title] of defaultColumns.entries()) {
            await insertColumn(
                {
                    id: `col-${crypto.randomUUID()}`,
                    boardId: id,
                    title,
                    order: index,
                    createdAt: now,
                    updatedAt: now,
                },
                tx,
            )
        }
    }

    if (executor) {
        await run(executor)
    } else {
        await withTx(async (tx) => {
            await run(tx)
        })
    }

    await createDefaultBoardStructure(id)
    const project = await getProject(id)
    if (!project) {
        throw new Error('Failed to create project')
    }
    return project
}

async function updateProject(id: string, updates: UpdateProjectRequest, executor?: DbExecutor): Promise<ProjectSummary | null> {
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
        return getProject(id, executor)
    }

    await updateBoard(id, payload, executor)
    return getProject(id, executor)
}

async function deleteProject(id: string, executor?: DbExecutor): Promise<boolean> {
    const existing = await getBoardById(id, executor)
    if (!existing) return false
    await deleteBoard(id, executor)
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
