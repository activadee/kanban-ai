---
title: Attempts & inspector (UI)
---

# Attempts & inspector (UI)

This guide describes how to use the card inspector to start and manage Attempts, run dev automation, and inspect logs.

## Card inspector overview

The Card Inspector is opened by clicking a card on the board. Its layout consists of:

- Header:
  - Ticket key and card title.
  - Copy ticket key button.
  - Blocked indicator (when dependencies are not satisfied).
  - Close button.
- Top-level tabs:
  - **Ticket** – shows the Details and Git controls for the card. This is the default tab whenever you open the inspector or switch to a different card.
  - **Attempts** – surfaces attempt-related controls. When no Attempt is running, you see the **Attempt create form** here; once an Attempt exists, this tab renders a nested tab view with **Messages**, **Processes**, and **Logs** sub-tabs for the selected Attempt. Cards with existing Attempts now open on this tab by default, while cards without Attempts still open on Ticket.

Switching cards recalculates which top-level tab should be active: cards without Attempts fall back to **Ticket**, while cards with Attempts open on **Attempts** (and its inner tabs). Navigating between Attempts, or when a new Attempt is detected, still resets the inner tab back to **Messages**, so you always start from the same view when focusing on new work.

## Starting an Attempt

- If the card has no active Attempt:
  - The **Attempt create form** appears inside the **Attempts** tab.
  - You can choose:
    - **Agent** – currently focused on the Codex agent.
    - **Profile** – per-project or global agent profile (or default).
  - Click **Start** to begin an Attempt:
    - A worktree is created under `~/.kanbanAI/worktrees/...`.
    - The Attempt is queued and started.
    - Board listeners may move the card into In Progress automatically.

### Auto-start when moving to In Progress

- When the global **Auto-start agent on In Progress** setting is enabled and a card is moved from **Backlog → In
  Progress**:
  - The server automatically starts an Attempt using the project’s default agent/profile.
  - If the Card Inspector is already open for that card, it will automatically attach to the new Attempt:
    - The Attempt header updates to show the new Attempt ID and status.
    - Messages and logs begin streaming in real time, without requiring a page reload.

If the card is blocked by dependencies and auto-start is disabled, the UI may prevent starting an Attempt depending on configuration.

## Messages tab

Inside the **Attempts** tab, the **Messages** sub-tab shows the live **conversation** with the agent:

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

Still inside the **Attempts** tab, the **Processes** sub-tab shows **dev automation and processes** associated with the Attempt:

- Latest dev script run (e.g. `bun test`, `npm test`, or other configured commands).
- Status of ongoing background tasks (pending, running, succeeded, failed).
- Controls:
  - **Run dev script**:
    - Re-runs the project’s configured dev script in the Attempt worktree.
  - **Stop Attempt**:
    - Same as in Messages, but surfaced from the processes view.
  - **View logs**:
    - Jumps to the **Logs** sub-tab (still inside **Attempts**) for more detailed output.

Use this tab when you want to re-run tests, linters, or other dev automation as part of the Attempt.

## Logs tab

The **Logs** sub-tab (inside **Attempts**) displays structured **logs** for the Attempt:

- Agent logs.
- Dev script output.
  - Internal events relevant to the Attempt.
- This tab is read-only and designed for debugging:
  - Scroll through the stream to see what commands ran and how they behaved.
  - Use it when troubleshooting failing Attempts or flaky dev scripts.

## Git, commit & PR flows in the inspector

These Git controls live in the Ticket tab’s Details area so you can edit card metadata while the Attempts tab shows agent activity. The Git section provides buttons and dialogs for:

- **Open in editor**:
  - Launches your preferred editor at the Attempt worktree path.
  - Uses the Editor module and respects app settings.
  - If the Attempt’s worktree has already been cleaned up (card moved to **Done**), the button is disabled with guidance
    to start a fresh Attempt before reopening an editor.
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

### Todos panel

- Next to the **Open in editor** button you now see a `<completed>/<total> Todos` button whenever the agent publishes todos for
  the current Attempt. It is powered by `attempt.todos.updated` events streamed through WebSockets so it always reflects the
  latest summary and never reuses todo text for commits.
- Clicking the button opens a read-only dialog that lists each todo with a tiny status indicator (`done` items are grayed
  out and struck through). The items are sorted so unfinished work appears first, helping you understand what the agent
  thinks still needs to happen without scrolling through the Messages tab.
