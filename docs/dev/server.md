To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

open http://localhost:3000

## Bootstrap layering
- `env.ts` loads and types all configuration (host/port, database path, migrations/static overrides).
- `db/client.ts` builds the SQLite client from the config and exposes it for injection.
- `start.ts` runs migrations, registers the core DB provider, then starts the Bun server.
- `app.ts` wires routes/services using the injected config/events/services, without reading env directly.
- `entry/dev.ts` and `entry/prod.ts` compose the pieces (env → db → core → app → entrypoint).
---
title: Server overview
---

## Version endpoint
- `/api/v1/version` exposes the running server version plus the latest available release.
- The running version is resolved from `KANBANAI_VERSION` or the nearest `package.json` named `kanban-ai`.
- Latest release metadata is fetched from GitHub Releases (`KANBANAI_UPDATE_REPO`, `KANBANAI_UPDATE_TOKEN`) with a short in-memory cache; failures return the current version with `updateAvailable: false` so the UI stays quiet when offline.
