import {Hono} from 'hono'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import type {AppEnv} from '../env'
import {githubRepo} from 'core'
import {createPR, findOpenPR} from './pr'
import {git} from 'core'
import {problemJson} from '../http/problem'

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
            return problemJson(c, {status: 502, detail: 'Failed to lookup PR'})
        }
    })

    // POST /projects/:id/github/pr
    router.post('/:id/github/pr', zValidator('json', createPrSchema), async (c) => {
        const {base, title, body, draft, branch} = c.req.valid('json')
        try {
            const auth = await githubRepo.getGithubConnection()
            if (!auth) return problemJson(c, {status: 401, title: 'GitHub authentication required', detail: 'Connect GitHub before creating pull requests'})
            let head = branch
            if (!head) {
                const st = await git.getStatus(c.req.param('id'))
                head = st.branch
            }
            if (!auth.accessToken) return problemJson(c, {
                status: 401,
                title: 'GitHub authentication required',
                detail: 'Connect GitHub before creating pull requests'
            })
            // Ensure branch is available on the remote before creating the PR to avoid 422 "head invalid"
            await git.push(c.req.param('id'), {branch: head, token: auth.accessToken, setUpstream: true})
            const pr = await createPR(c.req.param('id'), auth.accessToken, {base, head: head!, title, body, draft})
            return c.json({pr}, 200)
        } catch (error) {
            console.error('[github:pr:create] failed', error)
            const message = error instanceof Error ? error.message : 'Failed to create PR'
            const status = message.toLowerCase().includes('auth') ? 401 : 502
            return problemJson(c, {status, detail: message})
        }
    })

    return router
}
