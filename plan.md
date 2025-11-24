# Single-Origin Refactor Plan

Goal: keep local development as a split client/server workflow (`bun run dev`), and add a single-origin production/server entry so `bun run single` builds the client, copies static assets into `server/static`, and runs one Hono/Bun server that serves both API and UI.

---

## Phase 1 – Remove CLI packaging and surface area

1. **Remove CLI workspace (if present)**
   - If a `cli/` directory exists, delete it.
   - Remove `cli` from the root `workspaces` array in `package.json` (if it appears there).

2. **Delete CLI GitHub Actions workflow**
   - Remove `.github/workflows/release-cli.yml`.
   - Later, if needed, add a separate workflow that only builds the server or Docker images (no npm CLI, no binaries).

3. **Update documentation and AGENTS notes**
   - In `README.md`:
     - Remove the **One-Command Demo (`npx kanban-ai`)** section and all references to:
       - `npx kanban-ai`
       - downloaded binaries
       - `KANBANAI_VERSION` or any CLI-specific env vars
     - Replace that section with a short **Single-Origin Server** section that documents `bun run single` as the self-host path.
   - In the root `AGENTS.md`:
     - Remove or rewrite bullets that reference:
       - `cli/` workspace
       - `scripts/build-binaries.ts`
       - `build:binary` / `build:binary:<target>` scripts
       - publishing a CLI package to npm
     - Clarify that static serving is now handled only by a dedicated server entrypoint in `server/` (see Phase 2), not by a CLI binary.

4. **Clean up CLI-only environment variables**
   - Keep env vars that are still useful for the server:
     - `KANBANAI_DEBUG`
     - `KANBANAI_MIGRATIONS_DIR`
   - Remove any documentation for CLI-only env vars (e.g., `KANBANAI_VERSION`) from `README.md` and other docs.

---

## Phase 2 – Add dedicated single-origin server entry (`server/src/single.ts`)

Goal: introduce a new entrypoint that composes the existing API app with static file serving and SPA fallback, without changing `createApp` or `dev.ts`.

5. **Create `server/src/single.ts`**
   - Responsibilities:
     - Parse `--host`, `--port`, and optionally `--migrations-dir` from `Bun.argv` (reuse helpers from `server/src/dev.ts`).
     - Call `createWebSocket()` and `createApp({ upgradeWebSocket })` just like `dev.ts`.
     - Build a composed `fetch` function that:
       - Routes `/api/*` (and `/api/v1/*`) to `app.fetch`.
       - Routes everything else through a new static app (`staticApp`) that serves files and SPA fallback.
     - Call `startServer({ host, port, fetch: composedFetch, websocket, migrationsDir })`.
     - Log the server URL, database file path, and resolved migrations directory.

6. **Implement a static-serving Hono app inside `single.ts`**
   - Use Hono + Bun adapter:
     - `import { Hono } from 'hono'`
     - `import { serveStatic } from 'hono/bun'`
   - Decide how to resolve the static root:
     - Default to `server/static` when running from built JS (e.g., `path.join(__dirname, '../static')`).
     - Respect `KANBANAI_STATIC_DIR` when set (resolve to an absolute path).
   - Build `staticApp` roughly as:
     - `staticApp.use('/assets/*', serveStatic({ root: staticRoot }))` for JS/CSS/assets.
     - `staticApp.use('/favicon.ico', serveStatic({ root: staticRoot }))` if needed.
     - `staticApp.get('*', serveStatic({ root: staticRoot, path: 'index.html' }))` for SPA fallback.
   - This app should not define any `/api` routes.

7. **Compose `staticApp` with the API app**
   - In `single.ts`, create a `composedFetch(request: Request)`:
     - Parse `const url = new URL(request.url)`.
     - If `url.pathname` starts with `/api` (or `/api/v1`), immediately call `apiApp.fetch(request)`.
     - Otherwise:
       - Call `staticApp.fetch(request)` and capture the response.
       - If the static response is not a 404, return it.
       - If it is a 404, optionally fall back to `apiApp.fetch(request)` so non-API routes like `/metrics` or `/` can still be handled by the API app on the same origin if desired.
   - Pass `composedFetch` into `startServer`:
     - `startServer({ host, port, fetch: composedFetch, websocket, migrationsDir })`.

8. **Keep `createApp` and `dev.ts` API-only**
   - Do not add any static file serving to `createApp` in `server/src/app.ts`.
   - Leave `server/src/dev.ts` as:
     - Build `createApp({ upgradeWebSocket })`.
     - Call `startServer({ fetch: app.fetch, websocket })`.
   - This preserves the development rule: server is API-only in dev; static serving happens only in `single.ts`.

---

## Phase 3 – Wire build pipeline for static assets

Goal: build client + server, then copy the client build into `server/static` so `single.ts` can serve it.

9. **Define `server/static` as build output**
   - Treat `server/static` as the destination for built client assets, not hand-edited files.
   - Keep Vite’s default client build output at `client/dist`.
   - The pipeline will sync `client/dist/*` → `server/static/*` during a single-origin build.

10. **Add a copy-static helper script**
   - Create `scripts/copy-static.ts` (or similar) in the repo root:
     - Resolve `client/dist` and `server/static`.
     - Remove existing contents of `server/static` (or delete and recreate the directory).
     - Recursively copy `client/dist` into `server/static`.
   - Alternatively use a shell script (`cp -R client/dist/* server/static/`) if you are okay with POSIX-only behavior; a Bun/TypeScript script is more portable.

11. **Extend root `package.json` scripts for single-origin**
   - Add scripts such as:
     - `"build:single": "bun run build:client && bun run build:server && bun run scripts/copy-static.ts"`
     - `"single": "bun run build:single && bun run server/dist/single.js"`
   - If you prefer to run the TypeScript entry directly:
     - `"single": "bun run build:client && bun run scripts/copy-static.ts && bun run server/src/single.ts"`
   - Choose one pattern and keep it consistent; key invariant is that `client/dist` is built and copied to `server/static` before the single-origin server starts.

12. **Keep existing build tasks intact**
   - Keep these as-is:
     - `"build": "turbo build"`
     - `"build:client": "turbo build --filter=client"`
     - `"build:server": "turbo build --filter=server"`
   - `build:single` should orchestrate these plus the copy step, without changing their behavior.

---

## Phase 4 – Dev workflow and client configuration

13. **Preserve current dev story (`bun run dev`)**
   - Keep root `dev` script:
     - `"dev": "turbo dev --filter=server --filter=client --filter=core --filter=shared"`
   - Ensure `server/src/dev.ts` still starts an API-only server (no static).
   - Vite dev server in `client` continues on `http://localhost:5173`.

14. **Confirm client → API configuration in dev**
   - Keep using `VITE_SERVER_URL` in `client/.env` (e.g., `http://localhost:3000/api/v1`) for API calls.
   - Verify that all client API calls use `import.meta.env.VITE_SERVER_URL` (or a shared helper built on it); normalize any hardcoded dev URLs.
   - Optionally, adopt a Vite `server.proxy` entry pointing `/api` to `http://localhost:3000` if you want the bhvr-style dev proxy instead of explicit `VITE_SERVER_URL`.

15. **Sanity-check the single-origin flow**
   - After implementing scripts and `single.ts`:
     - Run `bun run single`.
     - Confirm:
       - Static assets are served correctly (e.g., `/assets/...` from `server/static`).
       - Direct navigation to nested routes (e.g., `/dashboard`, `/boards/:id`) returns `index.html` and boots the SPA.
       - API endpoints remain available at `/api/v1/*` on the same origin.
   - Ensure these changes do not affect `bun run dev` behavior.

---

## Phase 5 – Documentation and cleanup

16. **Update README deployment section**
   - Document:
     - **Dev:** `bun run dev` (Vite on 5173 + API on 3000).
     - **Single-origin self-host:** `bun run single` (builds client and server, copies static assets, runs Hono server for API + UI on one port).
   - Remove references to serving `client/dist` in a completely separate host for production if you now prefer the single-origin path.

17. **Align AGENTS and docs**
   - In root `AGENTS.md` and any docs under `docs/`:
     - State clearly:
       - Development: server is API-only; UI is served by Vite.
       - Production single-origin: static serving is done only by `server/src/single.ts` (or its built JS), not by `dev.ts`.
   - Remove any lingering references to CLI packaging, `build:binary`, and `npx kanban-ai`.

18. **Clean up `server/static` handling**
   - Decide on version control strategy for `server/static`:
     - Option A: treat as build output:
       - Add `server/static` (or its contents) to `.gitignore`.
       - Remove tracked static files from Git, keeping maybe a `README.md` explaining it is build output.
     - Option B: keep an empty `server/static/.gitkeep` with a short note, but assume files will be overwritten by the copy step.

---

## Phase 6 – Optional: true single binary (later)

If you want to reintroduce a native single executable in the future (without a CLI/npm wrapper), base it on `single.ts`.

19. **Add a simple `build:binary` script (optional)**
   - After Phase 3 is in place, you can:
     - Add `"build:binary": "bun run build:single && bun build --compile server/dist/single.js --outfile dist/kanban-ai"` (adjust paths/options as needed).
   - This will produce a single executable that serves API + UI on one port.

20. **Reuse existing migration/static env semantics**
   - Keep using:
     - `KANBANAI_MIGRATIONS_DIR` for migrations (already handled by `resolveMigrations` in `server/src/runtime.ts`).
     - `KANBANAI_STATIC_DIR` for static assets override (hooked into the static root resolver in `single.ts`).
   - For the compiled binary, ensure these env vars still allow external folders to be used instead of the embedded bundle if needed.

