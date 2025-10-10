# CLI Contract — KanbanAI

This contract defines the user‑visible interface of the CLI when executed via the standard package runner.

## Command

- Name: `kanbanai`
- Synopsis: `kanbanai [--host <host>] [--port <port>] [--open|--no-open] [--help|-h] [--version|-v]`

## Options

- `--host <host>`
  - Description: Hostname/interface to bind.
  - Default: `127.0.0.1`

- `--port <port>`, `-p <port>`
  - Description: TCP port for the HTTP server.
  - Default: `3000`

- `--open`
  - Description: Open a browser window to `/app` after startup.
  - Default: Off unless explicitly provided. `--no-open` disables.

- `--no-open`
  - Description: Prevent automatic browser opening.

- `--help`, `-h`
  - Description: Print usage and exit with code 0.

- `--version`, `-v`
  - Description: Print version string and exit with code 0.

## Behavior

- Exit codes:
  - `0` on success and informational commands (`--help`, `--version`).
  - Non‑zero on failures (e.g., port in use, missing binary, unsupported platform).
- Stdout/stderr: Passed through verbatim from the underlying process.
- Arguments: Forwarded unchanged to the underlying server process.

## Examples

- `kanbanai` → starts server at `http://127.0.0.1:3000`.
- `kanbanai --port 5555 --open` → starts server and opens the browser.
- `kanbanai -h` → prints help.
