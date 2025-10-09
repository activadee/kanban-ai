import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {logger} from 'hono/logger'
import {secureHeaders} from 'hono/secure-headers'
import {etag} from 'hono/etag'
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
import type {Context} from 'hono'
//
// Readiness flag for /api/readyz
let ready = false
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

    // Security headers (exclude WebSocket upgrade paths)
    app.use('*', (c, next) => {
        if (c.req.path.startsWith('/api/ws')) return next()
        return secureHeaders({
            referrerPolicy: 'strict-origin-when-cross-origin',
        })(c, next)
    })

    // ETag for SPA responses
    app.use('/app/*', etag())

    // CORS only for REST endpoints (exclude websockets)
    app.use('/api/*', (c, next) => {
        if (c.req.path.startsWith('/api/ws')) return next()
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

    // Mount API under /api/*
    const api = new Hono<AppEnv>()
    // Health probes
    api.get('/healthz', (c) => c.json({ok: true}))
    api.get('/readyz', (c) => c.json({ok: ready}, ready ? 200 : 503))
    api.route('/projects', createProjectsRouter())
    // GitHub PR endpoints under /projects/:id/github/*
    api.route('/projects', createGithubProjectRouter())
    api.route('/auth/github', createGithubRouter())
    api.route('/fs', createFilesystemRouter())
    api.route('/filesystem', createFilesystemRouter())
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

    app.route('/api', api)

    // Static client under /app: assets + SPA fallback
    registerClientRoutes(app)

    app.notFound((c) => c.json({error: 'Not Found'}, 404))

    app.onError((err, c) => {
        console.error('[app:error]', err)
        return c.json({error: 'Internal Server Error'}, 500)
    })

    return app
}

// --- Client static serving helpers
async function registerClientRoutes(app: Hono<AppEnv>) {
    // Dynamic import of generated embed map, falls back to filesystem in dev
    // The embed is generated by scripts/embed-client.ts into server/src/client-embed.ts
    let embed: any = null
    try {
        embed = await import('./client-embed')
    } catch {
        embed = null
    }

    async function serveIndex(c: Context) {
        const path = '/app/index.html'
        // Try embed first
        const hit = embed?.getClientAsset?.(path)
        if (hit) return c.body(hit.bytes, 200, {'Content-Type': hit.contentType, 'Cache-Control': 'no-store'})
        // Fallback to filesystem for dev
        const fsPath = new URL('../../client/dist/index.html', import.meta.url).pathname
        try {
            const file = Bun.file(fsPath)
            if (await file.exists()) return new Response(file, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-store'
                }
            })
        } catch {
        }
        return c.text('Client not built. Run: bun run build:client', 404)
    }

    async function serveAsset(c: Context, key: string) {
        // Try embed
        const hit = embed?.getClientAsset?.(key)
        if (hit) return c.body(hit.bytes, 200, {
            'Content-Type': hit.contentType,
            'Cache-Control': cacheControlFor(hit.contentType)
        })
        // Fallback to filesystem
        const rel = key.replace(/^\/app\/?/, '')
        const fsPath = new URL(`../../client/dist/${rel}`, import.meta.url).pathname
        try {
            const file = Bun.file(fsPath)
            if (await file.exists()) return new Response(file, {
                headers: {
                    'Content-Type': contentTypeFor(rel),
                    'Cache-Control': cacheControlFor(contentTypeFor(rel))
                }
            })
        } catch {
        }
        return null
    }

    function contentTypeFor(name: string) {
        const lower = name.toLowerCase()
        if (lower.endsWith('.html')) return 'text/html; charset=utf-8'
        if (lower.endsWith('.css')) return 'text/css; charset=utf-8'
        if (lower.endsWith('.js')) return 'text/javascript; charset=utf-8'
        if (lower.endsWith('.svg')) return 'image/svg+xml'
        if (lower.endsWith('.png')) return 'image/png'
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
        if (lower.endsWith('.gif')) return 'image/gif'
        if (lower.endsWith('.webp')) return 'image/webp'
        if (lower.endsWith('.ico')) return 'image/x-icon'
        if (lower.endsWith('.woff2')) return 'font/woff2'
        if (lower.endsWith('.woff')) return 'font/woff'
        if (lower.endsWith('.ttf')) return 'font/ttf'
        if (lower.endsWith('.map')) return 'application/json; charset=utf-8'
        return 'application/octet-stream'
    }

    function cacheControlFor(ct: string) {
        if (/text\/html/.test(ct)) return 'no-store'
        return 'public, max-age=31536000, immutable'
    }

    // Index at /app and /app/
    app.get('/app', serveIndex)
    app.get('/app/', serveIndex)
    // Static assets or SPA fallback
    app.get('/app/*', async (c) => {
        const urlPath = new URL(c.req.url).pathname
        const res = await serveAsset(c, urlPath)
        if (res) return res
        return serveIndex(c)
    })
}

if (import.meta.main) {
    const run = async () => {
        const {migrate} = await import('drizzle-orm/bun-sqlite/migrator')
        const {createBunWebSocket} = await import('hono/bun')

        // Parse CLI flags
        const args = Bun.argv.slice(2)
        const getArg = (name: string, alias?: string): string | undefined => {
            const i = args.indexOf(name)
            const j = alias ? args.indexOf(alias) : -1
            const idx = i >= 0 ? i : j
            if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]
            return undefined
        }
        const hasFlag = (name: string) => args.includes(name)

        if (hasFlag('--help') || hasFlag('-h')) {
            const usage = `\nkanbanai — KanbanAI server\n\nUsage:\n  kanbanai [--host <host>] [--port <port>] [--open|--no-open]\n\nOptions:\n  --host         Hostname to bind (default: 127.0.0.1)\n  --port, -p     Port to listen on (default: 3000)\n  --open         Open browser to /app\n  --no-open      Do not open browser\n  --help, -h     Show this help\n  --version, -v  Print version\n`
            console.log(usage)
            return
        }

        if (hasFlag('--version') || hasFlag('-v')) {
            console.log('kanbanai', 'v0.4.0')
            return
        }

        const port = Number(getArg('--port', '-p') ?? Bun.env.PORT ?? 3000)
        const host = getArg('--host') ?? Bun.env.HOST ?? '127.0.0.1'
        const shouldOpen = hasFlag('--open') && !hasFlag('--no-open')
        // DB location is always OS data dir; env variables and flags are ignored by design.
        const {db, sqliteDatabase} = await import('./db/client')
        const {registerCoreDbProvider} = await import('./db/provider')
        const migrationsFolder = await resolveMigrationsFolder()
        await migrate(db, {migrationsFolder})
        // Register core DB provider to route core repos to the same connection
        registerCoreDbProvider()
        // Warm settings cache so sync consumers can read defaults early
        try {
            await settingsService.ensure()
        } catch (e) {
            console.warn('[settings] init failed', e)
        }
        const {upgradeWebSocket, websocket} = createBunWebSocket()
        const app = createApp({upgradeWebSocket: upgradeWebSocket as UpgradeWebSocket<AppEnv>})

        // Register client routes (embed or FS fallback)
        // @ts-ignore - registerClientRoutes appended above
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        // intentionally run during startup before serve()
        await registerClientRoutes(app)
        const server = Bun.serve({
            port,
            hostname: host,
            fetch: app.fetch,
            websocket,
        })

        const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/app`
        const dbFile = sqliteDatabase.filename ?? 'db'
        console.log(`[server] listening on ${url.replace(/\/app$/, '')}`)
        console.log(`[server] database: ${dbFile}`)
        // Mark ready after server is listening
        ready = true
        if (shouldOpen) {
            try {
                await openBrowser(url)
            } catch (e) {
                console.warn('[server] failed to open browser', e)
            }
        }
    }

    run().catch((error) => {
        console.error('[server] failed to start', error)
        process.exit(1)
    })
}

async function openBrowser(url: string) {
    const platform = process.platform
    if (platform === 'darwin') {
        const proc = Bun.spawn(['open', url])
        await proc.exited
        return
    }
    if (platform === 'win32') {
        const proc = Bun.spawn(['cmd', '/c', 'start', '', url])
        await proc.exited
        return
    }
    const proc = Bun.spawn(['xdg-open', url])
    await proc.exited
}


async function resolveMigrationsFolder(): Promise<string> {
    // 1) Dev: local filesystem ../drizzle
    try {
        const devMeta = new URL('../drizzle/meta/_journal.json', import.meta.url).pathname
        if (await Bun.file(devMeta).exists()) return new URL('../drizzle', import.meta.url).pathname
    } catch {
    }

    // 2) Embedded TS: synthesize migrations from generated module (single source of truth for binary)
    try {
        const {EMBEDDED_MIGRATIONS, EMBEDDED_META} = await import('./drizzle-embed')
        return await synthesizeDrizzleFolder(EMBEDDED_META, EMBEDDED_MIGRATIONS)
    } catch {
    }

    throw new Error('Embedded migrations missing. Run `bun run package:embed:drizzle`.')
}

async function synthesizeDrizzleFolder(meta: {
    version: string;
    dialect: string;
    entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[]
}, migrations: { tag: string; sql: string }[]): Promise<string> {
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs/promises')
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'kanbanai-migrations-'))
    await fs.mkdir(path.join(tmpBase, 'meta'), {recursive: true})
    await fs.writeFile(path.join(tmpBase, 'meta', '_journal.json'), JSON.stringify(meta, null, 2))
    const byTag = new Map(migrations.map((m) => [m.tag, m.sql]))
    for (const entry of meta.entries) {
        const sql = byTag.get(entry.tag)
        if (!sql) continue
        await fs.writeFile(path.join(tmpBase, `${entry.tag}.sql`), sql)
    }
    return tmpBase
}
