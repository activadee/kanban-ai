/**
 * Script: create-ticket-single-binary.ts
 * Purpose: Create a single authoritative ticket to ship one binary that boots API + SPA.
 * Notes: Binary-only release for now; bunx/npx wrapper deferred and tracked inside the ticket.
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

    const title = 'Ship a single binary that serves API (/api) and SPA (/app)'
    const description = [
        'Context',
        '',
        '- Goal: produce one executable that starts the Hono API and serves the React UI.',
        '- Stack: Bun + Hono server, Vite + React client, SQLite via drizzle.',
        '- Distribution: binary-only for now. A bunx/npx wrapper will be done later (future task).',
        '',
        'Objectives',
        '',
        '- Provide per-platform binaries (linux, macOS, windows) built with `bun build --compile`.',
        '- Serve REST + WebSockets under `/api/*` and the SPA under `/app` (with index.html fallback).',
        '- Embed the built client into the binary, so no external files are required at runtime.',
        '- Use an OS-appropriate default data directory for the SQLite database if `DATABASE_URL` is not set.',
        '',
        'Deliverables',
        '',
        '- Server static routing:',
        '  - `/api/*`: all existing routers (projects, agents, attempts, settings, github, filesystem, dashboard).',
        '  - `/api/ws` and `/api/ws/dashboard`: websocket endpoints.',
        '  - `/app/assets/*`: hashed Vite assets.',
        '  - `/app/*`: SPA fallback to embedded `index.html`.',
        '- Client updates:',
        '  - `vite.config.ts` sets `base: "/app/"`.',
        '  - `BrowserRouter` uses `basename="/app"`.',
        '  - `SERVER_URL` default becomes `http://localhost:3000/api` (still overrideable by `VITE_SERVER_URL`).',
        '- Embed pipeline:',
        '  - Add `scripts/embed-client.ts` that reads `client/dist` and generates `server/src/client-embed.ts` mapping path → { bytes, contentType }.',
        '  - Server serves from embed in production; in dev we continue to use Vite/filesystem directly.',
        '- Packaging scripts (root):',
        '  - `package:client`: `vite build`.',
        '  - `package:embed`: generate `server/src/client-embed.ts`.',
        '  - `package:server`: `bun build --compile server/src/app.ts --outfile dist/kanbanai`.',
        '  - `package`: orchestrates the above and outputs artifacts under `dist/`.',
        '- Binary behavior:',
        '  - Flags: `--port`, `--host`, `--data-dir`, `--no-open` (optional: auto-open browser to `/app`).',
        '  - Drizzle migrations run at startup; database path resolves to OS data dir if not provided.',
        '',
        'Acceptance Criteria',
        '',
        '- Running `dist/kanbanai` starts the server; GET `/hello` returns JSON and `/app` loads the UI.',
        '- Deep-refresh of `/app/projects` returns the SPA (index.html), not JSON.',
        '- All client API calls succeed against `/api/*` and WS connects to `/api/ws` and `/api/ws/dashboard`.',
        '- No external assets are required next to the binary; database file lands in the user data directory by default.',
        '- `bun run package` produces `dist/kanbanai` on the local platform without errors.',
        '',
        'Implementation Plan (high level)',
        '',
        '1) Route layout: move routers under `/api` and wire `/app` static + SPA fallback.',
        '2) Client routing: set Vite base `/app/` and `BrowserRouter` basename `/app`.',
        '3) Embed: implement `scripts/embed-client.ts` and server `client-embed` loader.',
        '4) Packaging: add scripts and compile binary with `bun build --compile`.',
        '5) Data dir: update default SQLite path resolution (OS-specific) with env override.',
        '6) Smoke tests: verify endpoints, SPA refresh, and migrations run under the binary.',
        '7) Documentation: add a README “Binary Releases” section with usage and flags.',
        '',
        'Testing & Verification',
        '',
        '- Local: `bun run package` → `./dist/kanbanai` → visit `/app`, create a project, create a card.',
        '- Confirm DB file path printed in logs and contains expected tables/rows.',
        '- Hard refresh `/app/projects/:id` works; `/api/projects` returns JSON.',
        '',
        'Non-Goals',
        '',
        '- Docker images.',
        '- bunx/npx wrapper distribution (tracked as a follow-up).',
        '',
        'Future Follow-up (tracked here for reference; not in scope now)',
        '',
        '- Add a small npm CLI wrapper that downloads/extracts and runs the platform binary, similar to references/vibe-kanban/npx-cli.',
        '',
        'Open Questions',
        '',
        '1) Initial platform targets: linux-x64/arm64, macos-x64/arm64, windows-x64/arm64?',
        '2) Should we auto-open the browser to `/app` on start (default) or require `--open`?',
        '3) Keep `/metrics` at `/api/metrics` only, or also mirror at root temporarily?'
    ].join('\n')

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

