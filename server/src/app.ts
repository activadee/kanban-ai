import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {logger} from 'hono/logger'
import {secureHeaders} from 'hono/secure-headers'
import type {UpgradeWebSocket} from 'hono/ws'
import type {AppEnv, AppServices, ServerConfig} from './env'
import {getRuntimeConfig, setRuntimeConfig} from './env'
import {projectsService, settingsService, bindAgentEventBus, registerAgent} from 'core'
import {createProjectsRouter} from './projects/project.routes'
import {createBoardsRouter} from './projects/board.routes'
import {createGithubRouter} from './github/routes'
import {createFilesystemRouter} from './fs/routes'
import {kanbanWebsocketHandlers} from './ws/kanban-handlers'
import {createAttemptsRouter} from './attempts/routes'
import {createAgentsRouter} from './agents/routes'
import {createGithubProjectRouter} from './github/pr-routes'
import {createEditorsRouter} from './editor/routes'
import {createAppSettingsRouter} from './settings/routes'
import {createOnboardingRouter} from './onboarding/routes'
import {createEventBus, type AppEventBus} from './events/bus'
import {registerEventListeners} from './events/register'
import {createDashboardRouter} from './dashboard/routes'
import {registerWorktreeProvider} from './ports/worktree'
import {CodexAgent, OpencodeAgent, DroidAgent} from 'core'
import {dashboardWebsocketHandlers} from './ws/dashboard-handlers'
import {HTTPException} from 'hono/http-exception'
import {ProblemError, problemJson} from './http/problem'
import {log, applyLogConfig} from './log'
// Readiness flag for /api/v1/readyz (shimmed on /api/readyz temporarily)
let ready = false
export const setAppReady = (v: boolean) => { ready = v }

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
    config?: ServerConfig
}

export const createApp = ({
                              services = {projects: projectsService, settings: settingsService},
                              upgradeWebSocket,
                              events,
                              config
                          }: AppOptions = {}) => {
    let appConfig: ServerConfig
    if (config) {
        setRuntimeConfig(config)
        applyLogConfig(config)
        appConfig = config
    } else {
        appConfig = getRuntimeConfig()
    }
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

    if (appConfig.debugLogging) {
        app.use('*', logger((str, ...rest) => {
            const line = rest.length ? [str, ...rest].join(' ') : str
            log.debug({source: 'hono'}, line)
        }))
    }

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
        c.set('config', appConfig)
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
    api.route('/boards', createBoardsRouter())
    // GitHub PR endpoints under /projects/:projectId/pull-requests
    api.route('/projects', createGithubProjectRouter())
    api.route('/auth/github', createGithubRouter())
    api.route('/fs', createFilesystemRouter())
    api.route('/attempts', createAttemptsRouter())
    api.route('/agents', createAgentsRouter())
    api.route('/editors', createEditorsRouter())
    api.route('/settings', createAppSettingsRouter())
    api.route('/dashboard', createDashboardRouter())
    api.route('/onboarding', createOnboardingRouter())

    if (upgradeWebSocket) {
        api.get(
            '/ws',
            async (c, next) => {
                const boardId = c.req.query('boardId') ?? c.req.query('projectId')
                if (!boardId) return problemJson(c, {status: 400, detail: 'Missing boardId'})
                c.set('boardId', boardId)
                await next()
            },
            upgradeWebSocket((c) => kanbanWebsocketHandlers(c.get('boardId')!)),
        )
        api.get('/ws/dashboard', upgradeWebSocket(() => dashboardWebsocketHandlers()))
    } else {
        api.get('/ws', (c) => problemJson(c, {status: 503, detail: 'WebSocket support not configured'}))
        api.get('/ws/dashboard', (c) => problemJson(c, {status: 503, detail: 'WebSocket support not configured'}))
    }

    api.route('/metrics', createMetricsRouter())

    app.route('/api/v1', api)
    app.route('/api', api)

    app.notFound((c) => problemJson(c, {status: 404, detail: 'Not Found'}))

    app.onError((err, c) => {
        log.error({err}, '[app:error]')
        if (err instanceof ProblemError) {
            return problemJson(c, err.toProblem())
        }
        if (err instanceof HTTPException) {
            return problemJson(c, {status: err.status, detail: err.message})
        }
        return problemJson(c, {status: 500, title: 'Internal Server Error', detail: 'Unexpected error'})
    })

    return app
}
