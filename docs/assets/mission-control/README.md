# Mission Control visual assets

This folder is the canonical home for screenshots and short GIFs used by the Mission Control documentation.

Suggested filenames (referenced from `docs/guides/dashboard-ui.md`):

- `mission-control-overview.png` – full dashboard with KPI cards, Live Agent Activity, Inbox, Project Health, Agents & System, and Recent Attempt History visible.
- `mission-control-kpis.png` – close‑up of the KPI row.
- `mission-control-live-activity.png` – Live Agent Activity panel with active Attempts and recent activity.
- `mission-control-inbox.png` – Inbox panel with Review/Failed/Stuck tabs visible.
- `mission-control-project-health.png` – Project Health panel showing project rows, badges, and sorting controls.
- `mission-control-agents-system.png` – Agents & System panel showing system readiness, GitHub integration, and agent stats.
- `mission-control-time-range.gif` – short animation of changing the time range selector and watching KPIs/panels update.

To generate these locally:

1. Start the app in dev mode from the repository root:
   - `bun run dev`
2. When Vite starts the client, open the UI at the dev URL it prints in the terminal (for example `http://localhost:5173`) and navigate to `/dashboard`.
3. Capture the views above using your preferred screenshot tool.
4. Save the images in this folder with the suggested filenames so the docs can embed them.
