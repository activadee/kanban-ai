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
project’s configured enhancement agent. The button activates once a non-empty title is present, shows a spinner while
the enhancement request runs, and then displays an **AI suggestion preview** comparing the original and rewritten
content side by side. Choose **Accept** to apply the suggested title/description to the form or **Reject** to discard it
and keep editing manually.

You can also create cards directly in a column using column-specific controls (e.g. “Add card”) where present.

## Selecting cards & the inspector

- Click a card to open the **Card Inspector**:
  - On desktop:
    - The board and inspector appear in a side-by-side, resizable layout.
  - On mobile:
    - The inspector opens as a full-height sheet that slides in from the side.
- The inspector includes:
  - **Header**:
    - Ticket key (if present).
    - Card title.
    - Status/blocked indicators when relevant.
    - Copy ticket key and close buttons.
  - **Details**:
    - Editable title and description.
    - Dependencies picker (select other cards).
  - **Git section**:
    - Buttons for:
      - Open in editor.
      - View changes (diff dialog).
      - Commit.
      - Open PR.
      - Merge with base branch.

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
