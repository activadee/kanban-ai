# Settings Module

## Purpose

- Manage global application settings (theme, language, telemetry, editor preferences, git defaults).
- Provide HTTP endpoints for reading/updating settings and emit events so caches refresh consistently.

## Data & Event Flow

1. **Service Layer (`service.ts`)**
    - `ensureAppSettings` lazily bootstraps defaults and caches them in memory.
    - `updateAppSettings` writes to SQLite and refreshes the cache.
2. **Routes (`routes.ts`)**
    - `/settings` GET loads (ensuring defaults).
    - `/settings` PATCH validates input, updates settings, and emits `settings.global.updated`.
3. **Listeners (`listeners.ts`)**
    - Subscribes to `settings.global.updated` and calls `ensureAppSettings` to refresh the cache immediately.

## Key Entry Points

- `service.ts`: cache-aware CRUD operations for the singleton settings row.
- `routes.ts`: Hono endpoints.
- `listeners.ts`: cache invalidation hook.

## Open Tasks

- Extend events/listeners to notify interested modules (e.g., editor defaults, git defaults) when settings change.
- Add validation and persistence for future editor command templates per agent.
- Write tests covering cache refresh and failure scenarios.
