---
title: Dashboard (UI)
---

# Dashboard (UI)

The Dashboard page gives you a high-level view of projects, Attempts, and system status. This guide explains each panel.

## Accessing the Dashboard

- From the sidebar, click **Dashboard**.
- The Dashboard route is `/dashboard`.
- Under the hood it uses:
  - `GET /api/v1/dashboard` for the initial snapshot.
  - `/api/v1/ws/dashboard` to stream live updates.

## Metric cards

At the top of the page you’ll see four metric cards:

- **Projects** – number of boards/projects tracked.
- **Active Attempts** – Attempts currently `queued`, `running`, or `stopping`.
- **Attempts (24h)** – Attempts that completed (succeeded, failed, or stopped) in the last 24 hours.
- **Open Cards** – cards on boards that are not in a Done column.

Use these to gauge workload and automation at a glance.

## Active Attempts panel

- Lists attempts that are currently in progress:
  - Shows card title/ticket key, project name, agent, and status.
  - Each row provides a link back to the project board/card.
- Status indicators:
  - Use the same status badges as elsewhere in the app.
  - Help you spot stuck or failing Attempts quickly.

When no Attempts are active, the panel shows an empty-state message.

## Recent activity panel

- Shows a timeline of recently completed Attempts:
  - Includes success, failure, and stopped outcomes.
  - Displays the relative time since completion (e.g. “3 minutes ago”).
- This is useful for:
  - Reviewing what agents have done recently.
  - Spotting patterns in failed Attempts.

## Project snapshot panel

- Lists a subset of projects with:
  - Name and repository slug/path.
  - Total cards.
  - Open cards (not in Done) and active Attempts per project.
- Each project name links to the corresponding board.

Use this to identify overloaded projects or boards with too many open cards or Attempts.

## System status panel

- **GitHub**:
  - Shows whether you are connected to GitHub.
  - When connected:
    - Displays the connected username.
  - When not connected:
    - Suggests opening onboarding or Settings → GitHub to connect.
- **Agents**:
  - Shows the number of registered agents.
  - If none are registered:
    - Prompts you to add an agent under Agents settings.

This panel helps you quickly see whether core integrations (GitHub, agents) are ready before starting work.

