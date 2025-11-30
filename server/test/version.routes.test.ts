import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Hono} from 'hono'
import {createVersionRouter} from '../src/version/routes'
import {clearVersionCache} from '../src/version/service'

const createApp = () => {
    const app = new Hono()
    app.route('/version', createVersionRouter())
    return app
}

describe('GET /version', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        clearVersionCache()
    })

    it('returns updateAvailable when a newer release exists', async () => {
        const app = createApp()
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({tag_name: 'v9.9.9'}), {status: 200}),
        )

        const res = await app.request('/version')
        expect(res.status).toBe(200)

        const data = (await res.json()) as any
        expect(typeof data.currentVersion).toBe('string')
        expect(data.latestVersion).toBe('9.9.9')
        expect(data.updateAvailable).toBe(true)
        expect(typeof data.checkedAt).toBe('string')
    })

    it('falls back gracefully when the lookup fails', async () => {
        const app = createApp()
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

        const res = await app.request('/version')
        expect(res.status).toBe(200)

        const data = (await res.json()) as any
        expect(data.updateAvailable).toBe(false)
        expect(data.latestVersion).toBe(data.currentVersion)
        expect(typeof data.checkedAt).toBe('string')
    })
})
