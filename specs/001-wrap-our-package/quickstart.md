# Quickstart — Run via standard package runner

## Prerequisites

- A compatible package runner installed (e.g., Bun with `bunx`).
- No global install of the package is required.

## Build (maintainers)

1. From repo root, build the client and embed assets:
   - `bun run package:client`
   - `bun run package:embed`
   - `bun run package:embed:drizzle`
2. Build binaries to `dist/`:
   - `bun run package:server` (single current platform) or
   - `bun run package:all` (cross‑platform matrix)

## Invoke (users)

- Run the CLI via the package runner:
  - `bunx kanban-ai`  
    Starts the server and prints the listening URL.

- Pass arguments through:
  - `bunx kanban-ai --port 5555 --open`

- Help and version:
  - `bunx kanban-ai --help`
  - `bunx kanban-ai --version`

## Troubleshooting

- "Binary not found" error: Ensure the published package contains `dist/kanbanai*` for your platform or build locally using the steps above.
- Port already in use: Choose another port with `--port`.
