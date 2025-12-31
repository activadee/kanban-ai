import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {validateEditorExecutable} from 'core'
import {createHandlers} from '../lib/factory'
import {detectEditors} from './detect'
import {openEditorAtPath} from './open'

export const getEditorSuggestionsHandlers = createHandlers((c) => {
    const suggestions = detectEditors()
        .filter((editor) => editor.installed)
        .map((s) => ({
            key: s.key,
            label: s.label,
            bin: s.bin || '',
        }))
    return c.json({suggestions}, 200)
})

export const validateEditorHandlers = createHandlers(
    zValidator('json', z.object({
        path: z.string().min(1),
    })),
    async (c) => {
        const {path} = c.req.valid('json')
        const result = await validateEditorExecutable(path)
        return c.json(result, 200)
    },
)

export const openEditorAtPathHandlers = createHandlers(
    zValidator('json', z.object({
        path: z.string(),
        editorCommand: z.string().optional(),
    })),
    async (c) => {
        const {path, editorCommand} = c.req.valid('json')
        const result = await openEditorAtPath(path, {
            editorCommand,
        })
        if (!result) {
            return c.json({ok: false, message: 'Editor not configured'}, 400)
        }
        return c.json({ok: true, command: result.spec, env: result.env})
    },
)
