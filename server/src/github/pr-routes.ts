import {Hono} from 'hono'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {githubRepo} from 'core'
import {createPR, findOpenPR} from './pr'
import {git} from 'core'

const createPrSchema = z.object({
    base: z.string().min(1),
    title: z.string().min(1),
    body: z.string().optional(),
    draft: z.boolean().optional(),
    branch: z.string().optional(),
})

export function createGithubProjectRouter() {
    const router = new Hono<AppEnv>()

    // GET /projects/:id/github/pr?branch=
    router.get('/:id/github/pr', async (c) => {
        const branch = c.req.query('branch')
        if (!branch) return c.json({pr: null}, 200)
        try {
            const auth = await githubRepo.getGithubConnection()
            if (!auth) return c.json({pr: null}, 200)
            if (!auth.accessToken) return c.json({pr: null}, 200)
            const pr = await findOpenPR(c.req.param('id'), auth.accessToken, branch)
            return c.json({pr}, 200)
        } catch (error) {
            console.error('[github:pr:get] failed', error)
            return c.json({error: 'Failed to lookup PR'}, 500)
        }
    })

    // POST /projects/:id/github/pr
    router.post('/:id/github/pr', zValidator('json', createPrSchema), async (c) => {
        const {base, title, body, draft, branch} = c.req.valid('json')
        try {
            const auth = await githubRepo.getGithubConnection()
            if (!auth) return c.json({error: 'auth_required'}, 401)
            let head = branch
            if (!head) {
                const st = await git.getStatus(c.req.param('id'))
                head = st.branch
            }
            if (!auth.accessToken) return c.json({error: 'auth_required'}, 401)
            const pr = await createPR(c.req.param('id'), auth.accessToken, {base, head: head!, title, body, draft})
            return c.json({pr}, 200)
        } catch (error) {
            console.error('[github:pr:create] failed', error)
            const message = error instanceof Error ? error.message : 'Failed to create PR'
            return c.json({error: message}, 400)
        }
    })

    return router
}
