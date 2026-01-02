---
title: Attempts & inspector (UI)
---

# Attempts & inspector (UI)

This guide describes how to use the card inspector to start and manage Attempts, run dev automation, and inspect logs.

## Card inspector overview

The Card Inspector is opened by clicking a card on the board. On desktop it now shares space with the board in a
horizontal split: the board stays in the first panel while the inspector sits to the right, and a built-in handle
lets you repartition the width between them. You can adjust the inspector width relative to the viewport
(approximately 22 %–65 %, defaulting near 35 %) and the layout state is persisted under the `kanban-board-inspector`
auto-save key so reopening the board restores your preferred size. Storage automatically converts legacy string values
to numbers and falls back to in-memory storage when `localStorage` isn't available, so a corrupted value simply
resets to a valid proportion instead of breaking the split. On mobile the inspector still opens as a full-height sheet
that slides in from the side, keeping the focus on the tapped card.

Its layout consists of:

- Header:
   - Ticket key and card title.
   - Copy ticket key button.
   - Blocked indicator (when dependencies are not satisfied).
   - **View mode toggle** – switch between **Details** (ticket editing) and **Conversation** (attempt interaction) views.
   - Attempt toolbar (Open in editor, View changes, Commit, PR, Merge, Processes, Logs, and Todos controls) that appears whenever an Attempt exists.
   - Close button.

- View modes:
   - **Details** – shows the ticket details panel for editing card metadata (title, description, type, dependencies). The Enhance in background button is available here when enhancement is configured. The Attempt create form also appears at the bottom of this view when no Attempt exists.
   - **Conversation** – shows the attempt-related interface. When no Attempt is running, you see the **Attempt create form** here; once an Attempt exists, this view shows the Messages interface. Cards with existing Attempts open on this view by default, while cards without Attempts open on Details.

The Processes and Logs sections are accessible as slide-out panels from buttons in the toolbar, keeping the main view focused while allowing quick access to these tools.

## Retrying failed Attempts

When an Attempt has failed:
- The **Conversation** view shows the failed Attempt's status, conversation, and logs.
- A **Retry** button appears next to the controls, allowing you to re-run the Attempt without recreating the card.
- Clicking **Retry** re-queues the agent with the same configuration, and the Attempt status resets to `queued` then `running`.

Use this feature to quickly retry failed work after diagnosing the issue from logs or messages, without having to recreate the ticket.

## Starting an Attempt

- If the card has no active Attempt:
   - The **Attempt create form** appears in the **Conversation** view.
   - You can choose:
     - **Agent** – currently focused on the Codex agent.
     - **Profile** – per-project or global agent profile (or default).
   - Click **Start** to begin an Attempt:
     - A worktree is created under `~/.cache/kanban-ai/worktrees/...`.
     - The Attempt is queued and started.
     - Board listeners may move the card into In Progress automatically.

### Auto-start when moving to In Progress

- When the global **Auto-start agent on In Progress** setting is enabled and a card is moved from **Backlog → In
   Progress**:
   - The server automatically starts an Attempt using the project's default agent/profile.
   - If the Card Inspector is already open for that card, it will automatically attach to the new Attempt:
     - The Attempt header updates to show the new Attempt ID and status.
     - Messages and logs begin streaming in real time, without requiring a page reload.

If the card is blocked by dependencies and auto-start is disabled, the UI may prevent starting an Attempt depending on configuration.

## Messages

Inside the **Conversation** view, the **Messages** section shows the live **conversation** with the agent:

- Attempts stream messages as they run.
- You can send follow-up prompts by typing into the input and pressing send.
- **Images**: You can attach images to follow-up prompts by pasting from clipboard (Ctrl/Cmd+V) or dragging image files onto the input area. Attached images appear as thumbnails below the input and are sent along with your prompt. Supported formats: PNG, JPEG, WebP (max 10MB each, up to 5 images per message).
- "Thinking" entries (the agent's planning/analysis steps) now surface as collapsible blocks that default to their header summary (using the provided title or the first line of text alongside the timestamp); click the header to expand and read the full reasoning text.
- Message rendering – messages can display with rich formatting (Streamdown) including syntax highlighting, markdown, and code blocks, or as plain text. You can configure these preferences per message type (Assistant, User, System, Thinking) in **Settings → Rendering**.
- Images sent by you or the agent appear as compact badges in the conversation stream; click a badge to preview the image in a lightbox.
- Controls:
   - **Stop Attempt**:
     - Sends a stop request to the server.
     - The Attempt transitions to `stopping` / `stopped`.
   - **Profile selection for follow-ups**:
     - The follow-up panel can let you switch to a different profile for further messages (when supported).

Use this section to direct the agent, clarify requirements with text and images, and iterate on changes.

## Processes

The **Processes** panel shows **dev automation and processes** associated with the Attempt. Access it by clicking the **Processes** button in the inspector toolbar (when an Attempt exists):

- Latest dev script run (e.g. `bun test`, `npm test`, or other configured commands).
- Status of ongoing background tasks (pending, running, succeeded, failed).
- Controls:
   - **Run dev script**:
     - Re-runs the project's configured dev script in the Attempt worktree.
   - **Stop Attempt**:
     - Sends a stop request to the server.
   - **View logs**:
     - Opens the **Logs** slide-out panel for more detailed output.

Use this panel when you want to re-run tests, linters, or other dev automation as part of the Attempt.

## Logs

The **Logs** panel displays structured **logs** for the Attempt. Access it by clicking the **Logs** button in the inspector toolbar (when an Attempt exists):

- Agent logs.
- Dev script output.
- Internal events relevant to the Attempt.
- This panel is read-only and designed for debugging:
   - Scroll through the stream to see what commands ran and how they behaved.
   - Use it when troubleshooting failing Attempts or flaky dev scripts.

## Git, commit & PR flows in the inspector

The Git toolbar lives in the inspector header whenever an Attempt exists, providing persistent access to Git operations regardless of which view mode you're in. The toolbar includes:

- **Open in editor**:
   - Launches your preferred editor at the Attempt worktree path.
   - Uses the Editor module and respects app settings.
   - If the Attempt's worktree has already been cleaned up (card moved to **Done**), the button is disabled with guidance
     to start a fresh Attempt before reopening an editor.
- **Changes** (diff dialog):
   - Shows a structured diff of the Attempt's changes.
- **Commit**:
   - Opens a commit dialog.
   - Lets you enter a commit message and commit all changes in the Attempt worktree.
- **Open PR**:
   - Opens a PR dialog targeting the Attempt branch.
   - Pre-fills title/body based on templates and card details.
   - Links the PR back to the card and Attempt.
- **Merge**:
   - Runs a merge into the project's base branch (where configured).
- **Processes**:
   - Opens the Processes slide-out panel for managing dev automation.
- **Logs**:
   - Opens the Logs slide-out panel for viewing detailed output.

These actions map directly to the Attempt Git and PR APIs documented in `core/git-integration.md` and `core/github-integration.md`.

### Todos panel

- Next to the **Open in editor** button you now see a `<completed>/<total> Todos` button (also part of the header toolbar) whenever the agent publishes todos for the current Attempt. It is powered by `attempt.todos.updated` events streamed through WebSockets so it always reflects the latest summary and never reuses todo text for commits.
- Clicking the button opens a read-only dialog that lists each todo with a tiny status indicator (`done` items are gray
   out and struck through). The items are sorted so unfinished work appears first, helping you understand what the agent
   thinks still needs to happen without scrolling through the Messages tab.
