import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {logger} from 'hono/logger'
import {secureHeaders} from 'hono/secure-headers'
import type {UpgradeWebSocket} from 'hono/ws'
import type {AppEnv, AppServices} from './env'
import {projectsService, settingsService, bindAgentEventBus, registerAgent} from 'core'
import {createProjectsRouter} from './projects/routes'
import {createGithubRouter} from './github/routes'
import {createFilesystemRouter} from './fs/routes'
import {kanbanWebsocketHandlers, verifyProjectAccess} from './tasks/ws'
import {createAttemptsRouter} from './attempts/routes'
import {createAgentsRouter} from './agents/routes'
import {createGithubProjectRouter} from './github/pr-routes'
import {createEditorsRouter} from './editor/routes'
import {createAppSettingsRouter} from './settings/routes'
import {createEventBus, type AppEventBus} from './events/bus'
import {registerEventListeners} from './events/register'
import {createDashboardRouter} from './dashboard/routes'
import {registerWorktreeProvider} from './ports/worktree'
import {CodexAgent, OpencodeAgent, DroidAgent} from 'core'
import {dashboardWebsocketHandlers} from './dashboard/ws'
// Readiness flag for /api/v1/readyz (shimmed on /api/readyz temporarily)
let ready = false
export const setAppReady = (v: boolean) => { ready = v }
import * as console from "node:console";

function createMetricsRouter() {
    const router = new Hono<AppEnv>()
    router.get('/', (c) =>
        c.text('# TYPE kanbanai_requests_total counter\nkanbanai_requests_total{status="ok"} 1'),
    )
    return router
}

export type AppOptions = {
    services?: AppServices
    upgradeWebSocket?: UpgradeWebSocket<AppEnv>
    events?: AppEventBus
}

export const createApp = ({
                              services = {projects: projectsService, settings: settingsService},
                              upgradeWebSocket,
                              events
                          }: AppOptions = {}) => {
    const bus = events ?? createEventBus()
    registerEventListeners(bus, services)
    // Core adapters (worktree, agents)
    try {
        registerWorktreeProvider()
    } catch {
    }
    try {
        bindAgentEventBus(bus);
        registerAgent(CodexAgent as any);
        registerAgent(OpencodeAgent as any);
        registerAgent(DroidAgent as any)
    } catch {
    }
    // dynamic import block removed; using static imports above

    const app = new Hono<AppEnv>()

    // Request ID for tracing
    app.use('*', async (c, next) => {
        const id = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        c.res.headers.set('X-Request-Id', id)
        await next()
    })

    app.use('*', logger())

    const isApiWebSocket = (path: string) => path.startsWith('/api/ws') || path.startsWith('/api/v1/ws')

    // Security headers (exclude WebSocket upgrade paths)
    app.use('*', (c, next) => {
        if (isApiWebSocket(c.req.path)) return next()
        return secureHeaders({
            referrerPolicy: 'strict-origin-when-cross-origin',
        })(c, next)
    })

    // CORS only for REST endpoints (exclude websockets)
    app.use('/api/*', (c, next) => {
        if (isApiWebSocket(c.req.path)) return next()
        return cors()(c, next)
    })

    app.use('*', async (c, next) => {
        c.set('services', services)
        c.set('events', bus)
        await next()
    })

    // Health and hello at root for convenience/testing
    app.get('/', (c) => c.text('KanbanAI server is running'))
    app.get('/hello', (c) => c.json({message: 'Hello KanbanAI!', success: true}))

    // Mount API under /api/v1/* (with /api/* shim for transition)
    const api = new Hono<AppEnv>()
    // Health probes
    api.get('/healthz', (c) => c.json({ok: true}))
    api.get('/readyz', (c) => c.json({ok: ready}, ready ? 200 : 503))
    api.route('/projects', createProjectsRouter())
    // GitHub PR endpoints under /projects/:id/github/*
    api.route('/projects', createGithubProjectRouter())
    api.route('/auth/github', createGithubRouter())
    api.route('/fs', createFilesystemRouter())
    api.route('/attempts', createAttemptsRouter())
    api.route('/agents', createAgentsRouter())
    api.route('/editors', createEditorsRouter())
    api.route('/settings', createAppSettingsRouter())
    api.route('/dashboard', createDashboardRouter())

    if (upgradeWebSocket) {
        api.get(
            '/ws',
            async (c, next) => {
                const projectId = c.req.query('projectId')
                if (!projectId) return c.json({error: 'Missing projectId'}, 400)
                c.set('projectId', projectId)
                await next()
            },
            upgradeWebSocket((c) => kanbanWebsocketHandlers(c.get('projectId')!)),
        )
        api.get('/ws/dashboard', upgradeWebSocket(() => dashboardWebsocketHandlers()))
    } else {
        api.get('/ws', (c) => c.json({error: 'WebSocket support not configured'}, 503))
        api.get('/ws/dashboard', (c) => c.json({error: 'WebSocket support not configured'}, 503))
    }

    api.route('/metrics', createMetricsRouter())

    app.route('/api/v1', api)
    app.route('/api', api)

    app.notFound((c) => c.json({error: 'Not Found'}, 404))

    app.onError((err, c) => {
        console.error('[app:error]', err)
        return c.json({error: 'Internal Server Error'}, 500)
    })

    return app
}
