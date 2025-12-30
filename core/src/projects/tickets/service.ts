import type {TicketKeyPreview} from 'shared'
import {withRepoTx} from '../../repos/provider'
import type {ProjectSettingsRow} from '../../db/types'
import {getProjectSettingsRow, updateProjectSettingsRow} from '../settings/repo'
import {ensureProjectSettings} from '../settings/service'
import {listBoardIds, listCardsWithColumn, updateCard} from '../repo'
import {assertValidTicketPrefix, formatTicketKey, sanitizeTicketPrefix} from './ticket-keys'

export async function reserveNextTicketKey(projectId: string, now = new Date()): Promise<TicketKeyPreview> {
    return withRepoTx(async (provider) => {
        const row = await provider.projectSettings.getProjectSettingsRow(projectId) as ProjectSettingsRow | null
        if (!row) throw new Error('Project settings not found')
        const number = (row.nextTicketNumber ?? 1) as number
        const next = number + 1
        await provider.projectSettings.updateProjectSettingsRow(projectId, {nextTicketNumber: next, updatedAt: now})
        const prefix = row.ticketPrefix
        return {key: formatTicketKey(prefix, number), prefix, number}
    })
}

export async function previewNextTicketKey(projectId: string): Promise<TicketKeyPreview> {
    const row = await ensureProjectSettings(projectId)
    const number = row.nextTicketNumber ?? 1
    return {key: formatTicketKey(row.ticketPrefix, number), prefix: row.ticketPrefix, number}
}

export function isUniqueTicketKeyError(error: unknown): boolean {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
    return msg.includes('unique') && msg.includes('ticket')
}

export async function backfillTicketKeys(projectId?: string): Promise<{ updated: number; projects: number }> {
    const ids = projectId ? [projectId] : await listBoardIds()
    let updated = 0
    for (const pid of ids) {
        const row = await ensureProjectSettings(pid)
        const sanitized = sanitizeTicketPrefix(row.ticketPrefix)
        assertValidTicketPrefix(sanitized)
        if (sanitized !== row.ticketPrefix) {
            await updateProjectSettingsRow(pid, {ticketPrefix: sanitized})
        }

        const cards = await listCardsWithColumn(pid)
        let next = row.nextTicketNumber
        for (const c of cards) {
            if (!c.ticketKey) {
                const key = formatTicketKey(sanitized, next++)
                await updateCard(c.id, {ticketKey: key, boardId: pid, updatedAt: new Date()})
                updated += 1
            }
        }
        await updateProjectSettingsRow(pid, {nextTicketNumber: next})
    }
    return {updated, projects: ids.length}
}
