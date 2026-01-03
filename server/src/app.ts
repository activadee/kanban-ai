import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {logger} from 'hono/logger'
import {secureHeaders} from 'hono/secure-headers'
import type {AppEnv, AppServices, ServerConfig} from './env'
import {getRuntimeConfig, setRuntimeConfig} from './env'
import {requestId} from './lib/middleware'
import {projectsService, settingsService, bindAgentEventBus} from 'core'
import {createProjectsRouter} from './projects/project.routes'
import {createBoardsRouter} from './projects/board.routes'
import {createGithubRouter} from './github/routes'
import {createFilesystemRouter} from './fs/routes'
import {createAttemptsRouter} from './attempts/routes'
import {createAgentsRouter} from './agents/routes'
import {createGithubProjectRouter} from './github/pr-routes'
import {createEditorsRouter} from './editor/routes'
import {createAppSettingsRouter} from './settings/routes'
import {createOnboardingRouter} from './onboarding/routes'
import {createTerminalRouter, createProjectTerminalRouter} from './terminal/routes'
import {createWorktreesRouter} from './worktrees/worktrees.routes'
import {createEventBus, type AppEventBus} from './events/bus'
import {registerEventListeners} from './events/register'
import {createDashboardRouter} from './dashboard/routes'
import {registerWorktreeProvider} from './ports/worktree'
import {sseHandlers} from './sse/handlers'
import {HTTPException} from 'hono/http-exception'
import {ProblemError, problemJson} from './http/problem'
import {log, applyLogConfig} from './log'
import {createVersionRouter} from './version/routes'
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
    events?: AppEventBus
    config?: ServerConfig
}

export const createApp = ({
                              services = {projects: projectsService, settings: settingsService},
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
        // Bind the agent event bus; concrete agents are registered
        // in server/src/agents/registry.ts. Experimental agents
        // (for example, Droid) are intentionally not registered.
        bindAgentEventBus(bus)
    } catch {
    }

    const app = new Hono<AppEnv>()

    app.use('*', requestId)

    if (appConfig.debugLogging) {
        app.use('*', logger((str, ...rest) => {
            const line = rest.length ? [str, ...rest].join(' ') : str
            log.debug('hono', line)
        }))
    }

    app.use('*', secureHeaders({
        referrerPolicy: 'strict-origin-when-cross-origin',
    }))

    app.use('/api/*', cors())

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
    api.route('/projects/:projectId/terminals', createProjectTerminalRouter())
    api.route('/projects/:projectId/worktrees', createWorktreesRouter())
    api.route('/auth/github', createGithubRouter())
    api.route('/fs', createFilesystemRouter())
    api.route('/attempts', createAttemptsRouter())
    api.route('/agents', createAgentsRouter())
    api.route('/editors', createEditorsRouter())
    api.route('/settings', createAppSettingsRouter())
    api.route('/dashboard', createDashboardRouter())
    api.route('/onboarding', createOnboardingRouter())
    api.route('/version', createVersionRouter())
    api.route('/terminals', createTerminalRouter())

    // SSE endpoint for real-time updates
    // With boardId: board-specific events; without: global/dashboard events
    api.get('/sse', ...sseHandlers)

    api.route('/metrics', createMetricsRouter())

    app.route('/api/v1', api)
    app.route('/api', api)

    app.notFound((c) => problemJson(c, {status: 404, detail: 'Not Found'}))

    app.onError((err, c) => {
        log.error('app', 'error', {err})
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

export type AppType = ReturnType<typeof createApp>
