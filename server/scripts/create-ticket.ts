/**
 * Script: create-ticket.ts
 * Purpose: Create a detailed Kanban card ("ticket") in the latest or matching project.
 * Usage:
 *   bun scripts/create-ticket.ts [--project <id|name>] [--column <title>]
 *
 * Notes:
 * - If no project exists, a new one will be created using the repo root as repositoryPath.
 * - By default, the card is added to the "Backlog" column if present, otherwise the first column.
 */

import path from 'node:path'
import {existsSync} from 'node:fs'

import {projectsService} from '../src/projects/service'
import {listBoards, listColumnsForBoard, getBoardById, getCardById} from '../src/projects/repo'
import {createBoardCard, createDefaultBoardStructure} from '../src/tasks/service'

type Args = {
    project?: string
    column?: string
}

function parseArgs(argv: string[]): Args {
    const args: Args = {}
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--project') args.project = argv[++i]
        else if (a === '--column') args.column = argv[++i]
    }
    return args
}

async function resolveProjectId(preferred?: string): Promise<string> {
    // Prefer explicit ID/name match
    if (preferred) {
        const projects = await projectsService.list()
        const byId = projects.find((p) => p.id === preferred)
        if (byId) return byId.id
        const byName = projects.find((p) => p.name.toLowerCase() === preferred.toLowerCase())
        if (byName) return byName.id
    }

    // Try to match a board by repositoryPath (repo root)
    const repoRoot = path.resolve(process.cwd(), '..')
    const boards = await listBoards()
    const byRepo = boards.find((b) => path.resolve(b.repositoryPath) === repoRoot)
    if (byRepo) return byRepo.id

    // Fallback to most recent board
    if (boards.length > 0) return boards[0]!.id

    // Create a project if none exist
    const name = path.basename(repoRoot) || 'Project'
    const repoPath = existsSync(repoRoot) ? repoRoot : process.cwd()
    const created = await projectsService.create({name, repositoryPath: repoPath, initialize: false})
    return created.id
}

async function resolveColumnId(boardId: string, preferredTitle?: string): Promise<string> {
    await createDefaultBoardStructure(boardId)
    const columns = await listColumnsForBoard(boardId)
    if (columns.length === 0) throw new Error('No columns found for board')
    const byTitle = preferredTitle
        ? columns.find((c) => (c.title || '').trim().toLowerCase() === preferredTitle.trim().toLowerCase())
        : columns.find((c) => (c.title || '').trim().toLowerCase() === 'backlog')
    return (byTitle ?? columns[0]!).id
}

async function main() {
    const {project, column} = parseArgs(process.argv.slice(2))
    const boardId = await resolveProjectId(project)
    const columnId = await resolveColumnId(boardId, column)

    const title = 'Introduce Bunx packaging across monorepo'
    const description = `
Context
Adopt Bunx-driven packaging to create reproducible, cross-platform release artifacts for the monorepo (server + client). Standardize commands, leverage Bun's fast toolchain, and prep CI for tagged releases.

Goals
- Unify packaging entrypoints via \\\`bunx\\\` (no global installs).
- Produce distributables for the server (binary via \\\`bun build --compile\\\` or JS bundle) and client (Vite build).
- Create a single \\\`bun run package\\\` pipeline that outputs artifacts under \\\`dist/packages\\\`.
- Prepare CI to build artifacts for Linux, macOS, and Windows on tag pushes.

Deliverables
- Root scripts: 
  - \\\`package\\\`: orchestrates workspace packaging (server, client).
  - \\\`package:server\\\`: compiles server; bundles license/README and runtime assets.
  - \\\`package:client\\\`: runs Vite build; emits zipped static assets.
- Server packaging options:
  - Option A: Native binary with \\\`bun build --compile src/app.ts --outfile dist/server/kanbanai\\\`.
  - Option B: JS bundle (e.g., \\\`bun build src/app.ts --target bun --outdir dist/server\\\`) with a startup script.
- CI workflow (GitHub Actions): 
  - matrix: linux, macos, windows; bun setup; cache; \\\`bun run package\\\`.
  - Upload release assets named \\\`kanbanAI-<version>-<os>-<arch>.zip\\\`.
- Docs updates: README (Install, Package, Run), plus brief troubleshooting.

Acceptance Criteria
- Running \\\`bun run package\\\` produces:
  - Server artifact(s) in \\\`dist/packages/server\\\`.
  - Client artifact(s) in \\\`dist/packages/client\\\`.
  - Combined release zips with version + platform suffix.
- Server artifact starts locally and API responds at \\\`/hello\\\`.
- Client build succeeds and is viewable (served via any static host). Optionally, add static file serving in server.
- CI builds artifacts on tag pushes and attaches them to a GitHub Release.

Non-Goals
- Changing app features or database schema.
- Docker images (can be a follow-up).

Open Questions
1) Prefer native single-binary (\\\`bun build --compile\\\`) or JS bundle distribution?
2) Which OS/architecture(s) must we support initially?
3) Should server embed and serve the client build statically?
4) Target release cadence (on every tag vs. manual)?

Implementation Plan (high-level)
1) Add root scripts (package, package:server, package:client) using \\\`bunx\\\`.
2) Server: choose Option A or B; ensure drizzle migrations run at startup; verify DB path handling.
3) Client: run \\\`vite build\\\`; include \\\`dist\\\` in release assets.
4) CI: create \\\`.github/workflows/release.yml\\\` with matrix build + upload.
5) Documentation updates and release dry-run.
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

