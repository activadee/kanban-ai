import {SERVER_URL} from '@/lib/env'
import type {
    SubtaskListResponse,
    CreateSubtaskRequest,
    UpdateSubtaskRequest,
    ReorderSubtasksRequest,
} from 'shared'
import {parseApiResponse} from '@/api/http'

const jsonHeaders = {'Content-Type': 'application/json'}

export async function fetchSubtasks(
    projectId: string,
    ticketId: string,
): Promise<SubtaskListResponse> {
    const res = await fetch(
        `${SERVER_URL}/projects/${encodeURIComponent(projectId)}/tickets/${encodeURIComponent(ticketId)}/subtasks`,
    )
    return parseApiResponse<SubtaskListResponse>(res)
}

export async function createSubtask(
    projectId: string,
    ticketId: string,
    input: CreateSubtaskRequest,
): Promise<SubtaskListResponse> {
    const res = await fetch(
        `${SERVER_URL}/projects/${encodeURIComponent(projectId)}/tickets/${encodeURIComponent(ticketId)}/subtasks`,
        {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(input),
        },
    )
    return parseApiResponse<SubtaskListResponse>(res)
}

export async function updateSubtask(
    projectId: string,
    subtaskId: string,
    input: UpdateSubtaskRequest,
): Promise<SubtaskListResponse> {
    const res = await fetch(
        `${SERVER_URL}/projects/${encodeURIComponent(projectId)}/subtasks/${encodeURIComponent(subtaskId)}`,
        {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify(input),
        },
    )
    return parseApiResponse<SubtaskListResponse>(res)
}

export async function deleteSubtask(
    projectId: string,
    subtaskId: string,
): Promise<SubtaskListResponse> {
    const res = await fetch(
        `${SERVER_URL}/projects/${encodeURIComponent(projectId)}/subtasks/${encodeURIComponent(subtaskId)}`,
        {
            method: 'DELETE',
        },
    )
    return parseApiResponse<SubtaskListResponse>(res)
}

export async function reorderSubtasks(
    projectId: string,
    ticketId: string,
    input: ReorderSubtasksRequest,
): Promise<SubtaskListResponse> {
    const res = await fetch(
        `${SERVER_URL}/projects/${encodeURIComponent(projectId)}/tickets/${encodeURIComponent(ticketId)}/subtasks/reorder`,
        {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify(input),
        },
    )
    return parseApiResponse<SubtaskListResponse>(res)
}

