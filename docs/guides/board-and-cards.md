---
title: Boards & cards (UI)
---

# Boards & cards (UI)

This guide explains how to use the Kanban board UI: lanes, cards, dependencies, and GitHub issue import.

## Board layout

- Each project has a single board with four default columns:
  - **Backlog**
  - **In Progress**
  - **Review**
  - **Done**
- Columns are rendered in order across the screen. The header area shows:
  - Project name.
  - WebSocket connection status badge (Connected / Connecting… / Reconnecting…).
  - An **Import GitHub issues** button for the current board.
- Card titles inside the columns are truncated to a single line to keep cards from growing vertically, and hovering over a card reveals the full title in a tooltip so long text remains discoverable.
- The board header in the main content shows:
  - Title: “Kanban Board”.
  - A **Create Ticket** button to create a new card.

## Creating cards

- Click **Create Ticket** in the board header:
  - On large screens, a dialog opens allowing you to choose a column (default is the first column).
  - Fill in:
    - **Title** – required.
    - **Description** – optional.
    - **Dependencies** – optional list of other cards this card depends on.
- Submit to create the card in the chosen column.

While editing the description, a small bot button in the textarea lets you send the current title/description to the
project’s configured enhancement agent. The dialog now includes a **Create & Enhance** button beside **Create Ticket**,
which creates the card and immediately queues a background enhancement job. While the enhancement runs, the newly created
card surfaces an **Enhancing** badge and cannot be dragged. When the suggestion is ready, a sparkles icon appears on the
card; clicking it opens the enhancement diff dialog to compare the persisted title/description with the AI suggestion.
Accepting the suggestion updates the card, while rejecting it just clears the pending enhancement so you can try again
later.

You can also create cards directly in a column using column-specific controls (e.g. “Add card”) where present.

## Selecting cards & the inspector

- Click a card to open the **Card Inspector**:
  - On desktop:
    - The inspector now appears as the right panel in a horizontal split so it shares space with the board instead of
      overlaying it, and the handle resizes the panels side-by-side.
    - Drag the vertical handle to repartition the board/inspector widths (roughly 22 %–65 % of the viewport) and
      the layout state is stored under the `kanban-board-inspector` auto-save key so reopening the board restores the
      same ratio.
  - On mobile:
    - The inspector still opens as a full-height sheet that slides in from the side, keeping the focus on the tapped card.
- The inspector includes:
  - **Header**:
    - Ticket key (if present).
    - Card title.
    - Status/blocked indicators when relevant.
    - Copy ticket key and close buttons.
  - **Top-level tabs**:
    - **Ticket** – contains the Details and Git areas for editing card metadata. The details panel still provides title/description editing, the **Enhance in background** button, and the dependencies picker, while the Git section exposes Open in editor, View changes, Commit, Open PR, and Merge controls for the selected card/Attempt.
    - **Attempts** – surfaces attempt controls for the card. When no Attempt exists, you see the **Attempt create form** here (agent/profile selectors, Start button); once an Attempt is running, the tab shows nested **Messages**, **Processes**, and **Logs** sub-tabs for interacting with the current Attempt.

See the “Attempts & inspector (UI)” guide for the Attempts and activity sections inside the inspector.

## Dependencies in the UI

- In the Details panel:
  - Use the dependencies picker to add/remove dependencies on other cards.
  - Only cards on the same board can be selected.
  - Done-column cards still appear; they count as satisfied dependencies.
- When a card is **blocked**:
- The inspector shows it as blocked (based on current dependencies).
- Moving the card into **In Progress** may be prevented:
    - Backend validation will return a 409 if any dependency is not in Done.
    - The board shows a toast:
      - Title: “Task is blocked by dependencies”.
      - Description explaining that dependencies must be completed first.

## Card action menu

- Every card displays an ellipsis menu in its header with quick actions. **Open details** and **Edit…** are always available.
  - When the card is running a background enhancement job, the ellipsis menu is temporarily disabled and any open menu closes so the card keeps its focus on the pending enhancement.
- Backlog columns:
  - **Enhance ticket…** opens the Edit Ticket dialog for that card and immediately queues the background enhancement job using the current title/description.
  - **Start work** kicks off an Attempt using the project’s default agent and profile. The board shows a toast if the card is blocked or if no default agent/profile is configured.
- In Progress columns:
  - **Stop Attempt** becomes enabled while the latest Attempt is running (and shows a disabled state when nothing is active).
- Review columns:
  - **Create PR…** opens the same pull request dialog as the inspector, with identical defaults.
  - **Open in editor** reuses the Attempt editor integration and respects the same enablement rules as the inspector (default editor configured, attempt worktree available).
- Done and non-standard columns:
  - Only **Open details** and **Edit…** are shown so completed work stays read-only for Git/Attempt operations.

## Drag & drop

- Cards can be dragged:
  - Within a column to reorder.
  - Between columns to advance work (e.g. Backlog → In Progress).
- When dragging a card:
  - If the drop would move a blocked card into In Progress:
    - The drop is blocked.
    - A toast explains that dependencies must be completed first.
  - Other moves are allowed and immediately reflected on the board.
- The board uses WebSockets to apply server-pushed state:
  - Local drag results are reconciled with the authoritative board snapshot from the server.

## GitHub issue import

- Use the **Import GitHub issues** button in the project header:
  - Opens an **Import Issues** dialog.
  - Select:
    - Repository (e.g. `owner/repo`).
    - Filters (if available).
  - Confirm to import:
    - Issues become cards in **Backlog**.
    - Ticket keys and titles are derived from the GitHub issues.
- After import:
  - The board state is invalidated and re-fetched.
  - New cards appear live thanks to WebSocket updates.
