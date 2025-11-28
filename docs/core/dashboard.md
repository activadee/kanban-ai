# Dashboard

Last updated: 2025-11-28

## Purpose

- Provide a single place to monitor:
  - Overall project and card counts.
  - Active and recent Attempts.
  - Per-project workload.
  - System status (GitHub connection and agents).
- The Dashboard is powered by the `getDashboardOverview` service in `core`, surfaced over HTTP and WebSockets.

## Data model

- The Dashboard overview shape includes:
  - `metrics`:
    - `totalProjects` – count of boards/projects.
    - `activeAttempts` – Attempts in `queued`, `running`, or `stopping` states.
    - `attemptsLast24h` – completed Attempts in the last 24 hours.
    - `openCards` – cards on boards that are not in a **Done** column.
  - `activeAttempts` – a list of recent in-flight Attempts with:
    - Attempt ID, project name, card title/ticket key, agent, status, and timestamps.
  - `recentAttemptActivity` – recently finished Attempts, including outcome and completion time.
  - `projectSnapshots` – per-project snapshots:
    - Name, repository slug/path, card counts, open cards, and active Attempts per board.
  - `updatedAt` – last time the overview was computed.

## API and streaming

- HTTP:
  - `GET /api/v1/dashboard` – returns the current `DashboardOverview` snapshot.
- WebSocket:
  - The Dashboard channel uses a fixed `dashboard` ID.
  - On connect, it sends a `hello` message and the latest overview.
  - Subsequent updates are pushed periodically or when related events occur.
- Client hooks:
  - `useDashboardOverview` – fetches the snapshot over HTTP and caches it using React Query.
  - `useDashboardStream` – opens a WebSocket connection to receive live updates.

## UI panels

- **Metric cards**
  - Show high-level counts for projects, active Attempts, Attempts over the last 24h, and open cards.
- **Active Attempts**
  - Lists in-flight Attempts with status badges and links to their boards/cards.
- **Recent activity**
  - Shows recently completed Attempts (success, failure, stopped) with relative timestamps.
- **Project snapshot**
  - Per-project card totals, open card counts, and active Attempts; each entry links to the project board.
- **System status**
  - GitHub:
    - Uses the GitHub auth status API to report whether you are connected and which account is active.
  - Agents:
    - Uses the Agents registry to show how many agents are available and whether any are registered.

