import type {
    TerminalInfo,
    TerminalListResponse,
    EligibleCardsResponse,
} from 'shared'
import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export async function listProjectTerminals(projectId: string): Promise<TerminalInfo[]> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/terminals`)
    const data = await parseApiResponse<TerminalListResponse>(res)
    return data.terminals
}

export async function getEligibleCards(projectId: string): Promise<EligibleCardsResponse> {
    const res = await fetch(`${SERVER_URL}/projects/${projectId}/terminals/eligible`)
    return parseApiResponse<EligibleCardsResponse>(res)
}

export async function getTerminalInfo(cardId: string): Promise<TerminalInfo> {
    const res = await fetch(`${SERVER_URL}/terminals/${cardId}`)
    return parseApiResponse<TerminalInfo>(res)
}

export async function resizeTerminal(cardId: string, cols: number, rows: number): Promise<void> {
    const res = await fetch(`${SERVER_URL}/terminals/${cardId}/resize`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({cols, rows}),
    })
    await parseApiResponse(res)
}

export async function closeTerminal(cardId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/terminals/${cardId}`, {
        method: 'DELETE',
    })
    await parseApiResponse(res)
}

export function getTerminalWebSocketUrl(cardId: string, projectId: string): string {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = SERVER_URL.replace(/^https?:/, wsProtocol)
    return `${baseUrl}/terminals/${cardId}/ws?projectId=${encodeURIComponent(projectId)}`
}
