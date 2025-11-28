---
title: Attempts & inspector (UI)
---

# Attempts & inspector (UI)

This guide describes how to use the card inspector to start and manage Attempts, run dev automation, and inspect logs.

## Card inspector overview

The Card Inspector is opened by clicking a card on the board. It contains:

- Header:
  - Ticket key and card title.
  - Copy ticket key button.
  - Blocked indicator (when dependencies are not satisfied).
  - Close button.
- Details section:
  - Title, description, and dependencies editor.
  - Integrated Git section (open editor, changes, commit, PR, merge).
- Attempts area:
  - Either an **Attempt create form** (no active attempt yet), or
  - A tabbed view for an existing attempt (Messages / Processes / Logs).

## Starting an Attempt

- If the card has no active Attempt:
  - The **Attempt create form** is shown under the Details section.
  - You can choose:
    - **Agent** – currently focused on the Codex agent.
    - **Profile** – per-project or global agent profile (or default).
  - Click **Start** to begin an Attempt:
    - A worktree is created under `~/.kanbanAI/worktrees/...`.
    - The Attempt is queued and started.
    - Board listeners may move the card into In Progress automatically.

If the card is blocked by dependencies and auto-start is disabled, the UI may prevent starting an Attempt depending on configuration.

## Messages tab

- Shows the live **conversation** with the agent:
  - Attempts stream messages as they run.
  - You can send follow-up prompts by typing into the input and pressing send.
- Controls:
  - **Stop Attempt**:
    - Sends a stop request to the server.
    - The Attempt transitions to `stopping` / `stopped`.
  - **Profile selection for follow-ups**:
    - The follow-up panel can let you switch to a different profile for further messages (when supported).

Use this tab to direct the agent, clarify requirements, and iterate on changes.

## Processes tab

- Shows **dev automation and processes** associated with the Attempt:
  - Latest dev script run (e.g. `bun test`, `npm test`, or other configured commands).
  - Status of ongoing background tasks (pending, running, succeeded, failed).
- Controls:
  - **Run dev script**:
    - Re-runs the project’s configured dev script in the Attempt worktree.
  - **Stop Attempt**:
    - Same as in Messages, but surfaced from the processes view.
  - **View logs**:
    - Jumps to the Logs tab for more detailed output.

Use this tab when you want to re-run tests, linters, or other dev automation as part of the Attempt.

## Logs tab

- Shows structured **logs** for the Attempt:
  - Agent logs.
  - Dev script output.
  - Internal events relevant to the Attempt.
- This tab is read-only and designed for debugging:
  - Scroll through the stream to see what commands ran and how they behaved.
  - Use it when troubleshooting failing Attempts or flaky dev scripts.

## Git, commit & PR flows in the inspector

The Git section, rendered inside the Details area, provides buttons and dialogs for:

- **Open in editor**:
  - Launches your preferred editor at the Attempt worktree path.
  - Uses the Editor module and respects app settings.
- **Changes** (diff dialog):
  - Shows a structured diff of the Attempt’s changes.
- **Commit**:
  - Opens a commit dialog.
  - Lets you enter a commit message and commit all changes in the Attempt worktree.
- **Open PR**:
  - Opens a PR dialog targeting the Attempt branch.
  - Pre-fills title/body based on templates and card details.
  - Links the PR back to the card and Attempt.
- **Merge**:
  - Runs a merge into the project’s base branch (where configured).

These actions map directly to the Attempt Git and PR APIs documented in `core/git-integration.md` and `core/github-integration.md`.

