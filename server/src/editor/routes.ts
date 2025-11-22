import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {detectEditors, openEditorAtPath, type EditorKey} from './service'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'

export function createEditorsRouter() {
    const router = new Hono<AppEnv>()

    router.get('/', (c) => {
        const editors = detectEditors().filter((editor) => editor.installed)
        return c.json({editors}, 200)
    })

    // Generic opener (not attempt-specific)
    router.post('/open', zValidator('json', z.object({
        path: z.string(),
        editorKey: z.string().optional(),
    })), async (c) => {
        const {path, editorKey} = c.req.valid('json')
        const {spec, env} = await openEditorAtPath(path, {
            editorKey: editorKey as EditorKey | undefined,
        })
        return c.json({ok: true, command: spec, env})
    })

    return router
}
