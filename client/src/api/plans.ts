import type {CardPlan, SavePlanInput} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {ApiError, parseApiResponse} from '@/api/http'

const jsonHeaders = {'Content-Type': 'application/json'}

export async function fetchPlan(projectId: string, cardId: string): Promise<CardPlan | null> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}/plan`)
    try {
        return await parseApiResponse<CardPlan>(res)
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
    }
}

export async function savePlan(projectId: string, cardId: string, input: SavePlanInput): Promise<CardPlan> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}/plan`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(input),
    })
    return parseApiResponse<CardPlan>(res)
}

export async function deletePlan(projectId: string, cardId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/cards/${cardId}/plan`, {method: 'DELETE'})
    await parseApiResponse(res)
}

