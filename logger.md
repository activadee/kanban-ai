# Logging Plan for KanbanAI Server (Hono + Bun + Pino)

Goal: introduce a structured, production-grade logging setup for the `server/` workspace that:

- Keeps dev ergonomics simple (optional per-request logs, readable output).
- Produces structured JSON logs in prod and in binaries.
- Plays nicely with Hono (for request logging) and Bun (for performance).
- Minimizes invasive changes to existing code; can be adopted incrementally.

This plan is intentionally incremental and focused on `server/`. Client-side logging remains separate.

---

## Phase 1 – Introduce a shared logger facade (`server/src/log.ts`)

1. **Add a logger module**

   Create `server/src/log.ts` that exports a single `log` instance:

   - Use `pino` as the underlying logger.
   - Configure log level via `LOG_LEVEL` (fallback: `"info"`).
   - Include a small `base` object so logs are identifiable (`service: "kanban-ai-server"`).

   Example shape:

   ```ts
   import pino from 'pino'

   const level = process.env.LOG_LEVEL ?? 'info'

   export const log = pino({
     level,
     base: { service: 'kanban-ai-server' },
   })
   ```

2. **Keep the facade small**

   - Only export `log` (and optionally a `child` helper later).
   - Avoid exporting raw `pino` types everywhere; this keeps the option open to swap backends later.

3. **Wiring in Bun**

   - Bun supports stdout/stderr directly; no special transport config is needed.
   - JSON logs from Pino will appear in the same place as `console.log` does today (useful in Docker/Kubernetes).

---

## Phase 2 – Integrate with Hono request logging

Right now, Hono’s logger middleware is wired like this in `server/src/app.ts`:

```ts
import { logger } from 'hono/logger'
import * as console from 'node:console'

if (isDebugLoggingEnabled()) {
  app.use('*', logger((...args) => console.debug(...args)))
}
```

We want to preserve the behavior (conditional per-request logs), but send logs through `log.debug` instead of `console.debug`.

4. **Replace console-based Hono logger with Pino-backed one**

   In `app.ts`:

   - Import `log`:

     ```ts
     import { log } from './log'
     import { logger } from 'hono/logger'
     ```

   - Replace the middleware with:

     ```ts
     if (isDebugLoggingEnabled()) {
       app.use('*', logger((line) => {
         // `line` is a formatted string like "GET /api/v1/... 200 15ms"
         log.debug({ msg: line, source: 'hono' })
       }))
     }
     ```

   Notes:

   - This keeps the "opt-in debug logging" semantics, but outputs JSON lines under `log.debug`.
   - The `source: 'hono'` field makes it easy to filter request logs separately from application logs.

5. **Leave error handling intact for now**

   In `app.ts` you already have:

   ```ts
   app.onError((err, c) => {
     console.error('[app:error]', err)
     ...
   })
   ```

   In a later phase we’ll switch this to `log.error`, but it’s okay to leave as-is until the logger is introduced everywhere.

---

## Phase 3 – Migrate structured error and warning logs

Next, we want to replace "important" `console.*` with `log.*` so prod/binaries get structured error logs.

6. **App-level errors (Hono `onError`)**

   In `server/src/app.ts`, change:

   ```ts
   console.error('[app:error]', err)
   ```

   to:

   ```ts
   import { log } from './log'

   ...

   app.onError((err, c) => {
     log.error({ err }, '[app:error]')
     ...
   })
   ```

   - This makes all uncaught app errors show up as structured JSON, with a stack trace under `err`.

7. **Runtime/bootstrap warnings**

   In `server/src/start.ts`, you currently have:

   ```ts
   try {
     await settingsService.ensure();
   } catch (error) {
     console.warn("[settings] init failed", error);
   }
   ```

   Change to:

   ```ts
   import { log } from './log'

   ...

   try {
     await settingsService.ensure()
   } catch (error) {
     log.warn({ err: error }, '[settings] init failed')
   }
   ```

8. **Prod/dev entrypoint logs**

   In `server/src/entry/dev.ts` and `server/src/entry/prod.ts`, replace:

   ```ts
   console.log(`[server] listening on ${url}`)
   console.log(`[server] database: ${dbFile}`)

   console.log(`[prod] listening on ${url}`)
   console.log(`[prod] database: ${dbFile}`)
   console.log(`[prod] migrations: ${resolvedMigrationsDir}`)
   ```

   with:

   ```ts
   import { log } from '../log'

   log.info({ url, dbFile }, '[server] listening')

   log.info({ url, dbFile, migrationsDir: resolvedMigrationsDir }, '[prod] listening')
   ```

   and for fatal startup:

   ```ts
   log.error({ err: error }, '[prod] failed to start')
   ```

   This keeps the semantics but gives a more queryable shape in logs.

---

## Phase 4 – Service- and domain-level logging

Once the core logging is wired, you can gradually replace `console.*` in feature modules. Recommended order:

9. **Core/high-traffic services first**

   - `server/src/attempts/...`
   - `server/src/agents/...`
   - `server/src/github/...`
   - `server/src/projects/...`

   Pattern:

   ```ts
   import { log } from '../log' // or '../../log' depending on depth

   log.info({ projectId, boardId }, 'attempt started')
   log.error({ err, projectId }, 'github sync failed')
   ```

   Avoid passing large payloads directly (e.g. entire HTTP responses); log IDs and small summaries instead.

10. **Keep log levels consistent**

   - `log.debug` – noisy, request-level debugging; usually off in prod.
   - `log.info` – major lifecycle events (server start, attempt started, PR created).
   - `log.warn` – recoverable issues (fallbacks, retries, non-fatal API errors).
   - `log.error` – things that require attention (failed migrations, unhandled exceptions).

   This ties nicely into `LOG_LEVEL`, which you already use.

---

## Phase 5 – Configuration & docs

11. **Environment variables**

   - `LOG_LEVEL` controls Pino’s level (`debug`, `info`, `warn`, `error`).
   - Existing flags (`KANBANAI_DEBUG`, `DEBUG`) continue to control Hono’s request logger (via `isDebugLoggingEnabled()`).

   Document this in `README.md` under the "Logging" section:

   - Example:

     ```bash
     LOG_LEVEL=info bun run prod               # structured logs, no per-request traces
     LOG_LEVEL=debug KANBANAI_DEBUG=1 bun run prod   # structured logs + hono request logs
     ```

12. **Binary behavior**

   - No special handling is required for the compiled binaries.
   - Pino writes to stdout/stderr the same way `console` does; log aggregation should treat the binary the same as the JS server.

---

## Phase 6 – Optional enhancements

These are optional follow-ups if you want more control later:

13. **Per-module child loggers**

   - In `log.ts`, expose a `child` helper:

     ```ts
     export const log = pino({ ... })

     export const getLogger = (name: string) => log.child({ module: name })
     ```

   - In a module:

     ```ts
     const log = getLogger('git-service')
     log.info({ repo }, 'fetch started')
     ```

14. **Pretty-printing in dev**

   - Optionally enable `pino-pretty` in development only, via `transport` or Bun’s NODE_ENV check.
   - Keep JSON lines in prod/binaries.

15. **Redact sensitive fields**

   - Configure Pino with `redact` (e.g., headers, tokens) if you log request/response payloads.

---

## Summary

- Use `server/src/log.ts` as the single logging façade (Pino).
- Wire Hono’s request logger into it for optional per-request logging.
- Route all app errors, startup logs, and key service-level events through `log.*` instead of `console.*`.
- Adopt incrementally: start with core app and entrypoints, then move into services and routes as you touch them.

