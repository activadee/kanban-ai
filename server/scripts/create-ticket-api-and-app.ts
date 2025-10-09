/**
 * Script: create-ticket-api-and-app.ts
 * Purpose: Create a detailed Kanban card to move all server routes under `/api`
 *          and serve the React client statically under `/app` with SPA fallback.
 */

import path from 'node:path'
import {existsSync} from 'node:fs'

import {projectsService} from '../src/projects/service'
import {listBoards, listColumnsForBoard, getBoardById, getCardById} from '../src/projects/repo'
import {createBoardCard, createDefaultBoardStructure} from '../src/tasks/service'

async function resolveProjectId(): Promise<string> {
    const repoRoot = path.resolve(process.cwd(), '..')
    const boards = await listBoards()
    const byRepo = boards.find((b) => path.resolve(b.repositoryPath) === repoRoot)
    if (byRepo) return byRepo.id
    if (boards.length > 0) return boards[0]!.id
    const name = path.basename(repoRoot) || 'Project'
    const repoPath = existsSync(repoRoot) ? repoRoot : process.cwd()
    const created = await projectsService.create({name, repositoryPath: repoPath, initialize: false})
    return created.id
}

async function resolveBacklogColumnId(boardId: string): Promise<string> {
    await createDefaultBoardStructure(boardId)
    const columns = await listColumnsForBoard(boardId)
    if (columns.length === 0) throw new Error('No columns found for board')
    const byTitle = columns.find((c) => (c.title || '').trim().toLowerCase() === 'backlog')
    return (byTitle ?? columns[0]!).id
}

async function main() {
    const boardId = await resolveProjectId()
    const columnId = await resolveBacklogColumnId(boardId)

    const title = 'Prefix server under /api and serve SPA under /app'
    const description = `
Context
The server API routes currently live at the root (e.g., /projects), which collides with SPA paths when hard-refreshing. We want a clear separation:
- All server endpoints (REST + WebSockets) live under /api
- The React client is built with Vite and served statically under /app with an SPA fallback to index.html

Scope
- Add /api prefix for all server routes, including WebSockets and metrics.
- Serve client build under /app with hashed assets and SPA fallback.
- Update client routing and environment defaults accordingly.

Changes (server)
- server/src/app.ts
  - Mount routers under /api: /api/projects, /api/agents, /api/attempts, /api/settings, /api/github, /api/filesystem, /api/dashboard
  - WebSockets: /api/ws and /api/ws/dashboard (via Hono/Bun upgrade)
  - Metrics: /api/metrics (optional) — keep /metrics alias for a short deprecation window
  - Keep GET / returning a tiny health page or redirect to /app
  - Static:
    - import { serveStatic } from 'hono/bun'
    - const clientRoot = new URL('../../client/dist', import.meta.url).pathname
    - app.use('/app/assets/*', serveStatic({ root: clientRoot }))
    - app.get('/app/*', serveStatic({ root: clientRoot, path: 'index.html' })) // SPA fallback

Changes (client)
- client/src/App.tsx: <BrowserRouter basename="/app">.
- client/vite.config.ts: set base: '/app/'.
- client/src/lib/env.ts: default SERVER_URL = 'http://localhost:3000/api'.
- client WebSocket URLs:
  - Board: ws://<host>/api/ws
  - Dashboard: ws://<host>/api/ws/dashboard

Dev/Prod considerations
- CORS already enabled; continue to call the Bun server directly in dev using VITE_SERVER_URL=http://localhost:3000/api.
- Vite dev server remains on a separate port; packaging uses static /app for production.

Acceptance Criteria
- Hitting /app in a browser loads index.html; deep-links like /app/projects and /app/projects/<id> hard-refresh correctly render the SPA.
- All existing FETCH calls work when SERVER_URL includes /api.
- WebSocket connections succeed at /api/ws and /api/ws/dashboard for board and dashboard streams respectively.
- Existing root endpoints are either removed or respond with a deprecation message for one minor version.

Migration Plan
1) Introduce /api-prefixed routes alongside existing ones and ship a deprecation banner in logs.
2) Update client defaults and verify in dev.
3) Switch static serving for built client under /app.
4) Remove legacy root routes after one minor release.

Open Questions
1) Keep /metrics at root or move to /api/metrics only?
2) Should /ws remain at root temporarily for compatibility?
3) Any reverse proxy constraints (NGINX/Traefik) that require different prefixes?
`

    const cardId = await createBoardCard(columnId, title, description)
    const card = await getCardById(cardId)
    const board = await getBoardById(card?.boardId ?? boardId)

    console.log(JSON.stringify({
        created: true,
        board: {id: board?.id, name: board?.name},
        columnId,
        card: {id: card?.id, ticketKey: card?.ticketKey ?? null, title},
    }, null, 2))
}

main().catch((err) => {
    console.error('[create-ticket] failed', err)
    process.exit(1)
})

