import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import {detectEditors} from './detect'
import {openEditorAtPath} from './open'
import {validateEditorExecutable} from 'core'

export function createEditorsRouter() {
    const router = new Hono<AppEnv>()

    router.get('/suggestions', (c) => {
        const suggestions = detectEditors()
            .filter((editor) => editor.installed)
            .map((s) => ({
                key: s.key,
                label: s.label,
                bin: s.bin || '',
            }))
        return c.json({suggestions}, 200)
    })

    router.post('/validate', zValidator('json', z.object({
        path: z.string().min(1),
    })), async (c) => {
        const {path} = c.req.valid('json')
        const result = await validateEditorExecutable(path)
        return c.json(result, 200)
    })

    // Generic opener (not attempt-specific)
    router.post('/open', zValidator('json', z.object({
        path: z.string(),
        editorCommand: z.string().optional(),
    })), async (c) => {
        const {path, editorCommand} = c.req.valid('json')
        const result = await openEditorAtPath(path, {
            editorCommand,
        })
        if (!result) {
            return c.json({ok: false, message: 'Editor not configured'}, 400)
        }
        return c.json({ok: true, command: result.spec, env: result.env})
    })

    return router
}
