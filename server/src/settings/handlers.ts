import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {ensureAppSettings, updateAppSettings} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'

const updateSettingsSchema = z.object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    language: z.enum(['browser', 'en', 'ja']).optional(),
    telemetryEnabled: z.boolean().optional(),
    notificationsAgentCompletionSound: z.boolean().optional(),
    notificationsDesktop: z.boolean().optional(),
    autoStartAgentOnInProgress: z.boolean().optional(),
    editorType: z.enum(['VS_CODE', 'WEBSTORM', 'ZED']).nullable().optional(),
    editorCommand: z.string().nullable().optional(),
    gitUserName: z.string().nullable().optional(),
    gitUserEmail: z.string().email().nullable().optional().or(z.string().trim().length(0)).optional(),
    branchTemplate: z.string().optional(),
    ghPrTitleTemplate: z.string().nullable().optional(),
    ghPrBodyTemplate: z.string().nullable().optional(),
    ghAutolinkTickets: z.boolean().optional(),
    opencodePort: z.number().int().min(1).max(65535).optional(),
    streamdownAssistantEnabled: z.boolean().optional(),
    streamdownUserEnabled: z.boolean().optional(),
    streamdownSystemEnabled: z.boolean().optional(),
    streamdownThinkingEnabled: z.boolean().optional(),
})

export const getAppSettingsHandlers = createHandlers(async (c) => {
    const settings = await ensureAppSettings()
    return c.json({settings}, 200)
})

export const updateAppSettingsHandlers = createHandlers(
    zValidator('json', updateSettingsSchema),
    async (c) => {
        const body = c.req.valid('json')
        try {
            const events = c.get('events')
            const settings = await updateAppSettings(body)
            events.publish('settings.global.updated', {
                changes: body,
                updatedAt: settings.updatedAt,
            })
            return c.json({settings}, 200)
        } catch (err) {
            log.error('settings', 'update failed', {err})
            return problemJson(c, {status: 502, detail: 'Failed to update settings'})
        }
    },
)
