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
- Columns are visually distinguished by color-coded top borders that indicate their lane type:
   - **Backlog** – amber border
   - **In Progress** – blue border
   - **Review** – violet border
   - **Done** – emerald border
   - Other columns – slate border
- Columns are rendered in order across the screen. The page header shows:
   - Project name (with "Kanban Board" as a small label above it).
   - WebSocket connection status badge (Connected / Connecting… / Reconnecting…).
   - An **Import GitHub issues** button for the current board.
   - A **Sort order** dropdown to change how tickets are displayed within each column.
- Card titles inside the columns are truncated to a single line to keep cards from growing vertically, and hovering over a card reveals the full title in a tooltip so long text remains discoverable.
- The page header includes:
   - Title: the project name (with "Kanban Board" kicker above it).
   - Sort order dropdown in the controls area.
   - A **Create Ticket** button in the actions area.
- Cards surface status indicators through visual styling:
   - **In Progress** cards with a running Attempt display an animated loading border around the card that rotates continuously, providing visual feedback that work is actively being processed.
   - **Blocked** cards show a lock icon with "Blocked" label and a diagonal stripe pattern on the left border.
   - **Failed** cards display an alert icon with "Failed" label and a pulsing glow animation when their latest Attempt has failed. Failed cards can be clicked to open the Card Inspector for review and retry.
    - **Enhanced** cards feature a green bookmark icon in the top-right corner.
   - **Enhancing** cards show a spinner icon while background enhancement is running.
   - **Done** cards appear with reduced opacity and a grayscale filter.
   - **Selected** cards display a ring outline around them.
   - Each card also has a colored left border that indicates its ticket type (e.g., feat, fix, chore, docs).

### Sorting tickets

- The page header includes a **Sort order** dropdown in the controls area with three options:
   - **Newest first** – displays tickets in each column ordered by creation date, with the most recently created tickets at the top (default).
   - **Oldest first** – displays tickets in each column ordered by creation date, with the oldest tickets at the top.
   - **Custom order** – maintains the manual order you set via drag & drop, so cards stay in the exact positions you arrange them.
- The sort preference is persisted in your browser's local storage, so it's remembered across page reloads and board refreshes.
- Drag & drop reordering is always available regardless of sort mode; when a custom order is selected, your manual arrangement becomes the displayed order.

## Creating cards

- Click **Create Ticket** in the board header:
   - On large screens, a dialog opens allowing you to choose a column (default is the first column).
   - Fill in:
     - **Title** – required.
     - **Description** – optional.
     - **Images** – optional screenshots or images. You can paste images from the clipboard (Ctrl/Cmd+V) or drag and drop image files onto the dialog. Supported formats: PNG, JPEG, WebP (max 10MB each, up to 5 images per card). Attached images appear as thumbnails; click to preview in a lightbox, or use the X button to remove.
     - **Dependencies** – optional list of other cards this card depends on.
     - When GitHub Issue Creation is enabled in project settings (`githubIssueAutoCreateEnabled`), a **Create GitHub Issue**
       checkbox appears. Checking it creates a GitHub issue in the project's origin repository using the ticket title/
       description and links it back to the card. The card is still created if issue export fails, but the UI surfaces a
       toast with the error.
- Submit to create the card in the chosen column.

While editing the description, a small bot button in the textarea lets you send the current title/description to the
project's configured enhancement agent. The dialog now includes a **Create & Enhance** button beside **Create Ticket**,
which creates the card and immediately queues a background enhancement job. While the enhancement runs, the newly created
card surfaces an **Enhancing** badge and cannot be dragged. When the suggestion is ready, a sparkles icon appears on the
card; clicking it opens the enhancement diff dialog to compare the persisted title/description with the AI suggestion.
Accepting the suggestion updates the card, while rejecting it just clears the pending enhancement so you can try again
later. Accepted enhancements also flip the card's `isEnhanced` flag, which renders a green bookmark icon at the top-right
corner so polished tickets remain visible even after you reload the board.

You can also create cards directly in a column using column-specific controls (e.g. "Add card") where present.

## Selecting cards & the inspector

- Click a card to open the **Card Inspector**:
   - On desktop:
     - The inspector now appears as the right panel in a horizontal split so it shares space with the board instead of
       overlaying it, and the handle resizes the panels side-by-side.
      - Drag the vertical handle to repartition the board/inspector widths (roughly 22 %–65 % of the viewport) and
        the layout state is stored under the `kanban-board-inspector` auto-save key so reopening the board restores the
        same ratio. The storage layer handles legacy string values by automatically converting them to numbers and
        falls back to memory when `localStorage` is blocked, so even malformed values simply reset to a valid size
        instead of breaking the split.
   - On mobile:
     - The inspector still opens as a full-height sheet that slides in from the side, keeping the focus on the tapped card.
   - The board page accepts a `cardId` query parameter (for example `/projects/<projectId>?cardId=<cardId>`) so dashboard cards, side panels, and activity lists can deep link directly to a task and open the inspector without an extra click.
- The inspector includes:
   - **Header**:
     - Ticket key (if present).
     - Card title.
     - Status/blocked indicators when relevant.
     - View mode toggle (Details/Conversation) for switching between ticket editing and attempt interaction.
     - Attempt toolbar (Open in editor, View changes, Commit, Open PR, Merge, Processes, Logs, and Todos controls) that appears whenever an Attempt exists.
     - Copy ticket key and close buttons.
   - **Details view**:
     - Contains the ticket details panel for editing card metadata (title, description, type, dependencies).
     - The Enhance in background button when enhancement is configured.
     - The Attempt create form at the bottom when no Attempt exists.
   - **Conversation view**:
     - Shows the attempt interface for interacting with the current Attempt.
     - When no Attempt exists, displays the Attempt create form.
     - When an Attempt exists, shows the Messages interface for interacting with the agent.
     - Access Processes and Logs through slide-out panels triggered by buttons in the toolbar.

See the "Attempts & inspector (UI)" guide for detailed information about managing Attempts, viewing processes, and inspecting logs.

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
      - Title: "Task is blocked by dependencies".
      - Description explaining that dependencies must be completed first.

## Card action menu

- Every card displays an ellipsis menu in its header with quick actions. **Open details** and **Edit…** are always available.
   - **Edit…** opens the Edit Ticket dialog where you can modify the title, description, and images. Existing images are shown as thumbnails, and you can paste or drag new images to add more (up to 5 total). New images sent with "Enhance in background" are marked separately from saved images.
   - When the card is running a background enhancement job, the ellipsis menu is temporarily disabled and any open menu closes so the card keeps its focus on the pending enhancement.
- Backlog columns:
   - **Enhance ticket…** opens the Edit Ticket dialog for that card and immediately queues the background enhancement job using the current title/description.
   - **Start work** kicks off an Attempt using the project's default agent and profile. The board shows a toast if the card is blocked or if no default agent/profile is configured.
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
    - Failed cards have drag disabled until the failed Attempt is resolved or a new Attempt is started, but you can click on them to open the Card Inspector and retry the attempt.
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

## Auto-closing Review cards

- When a project has GitHub Issue Sync enabled and GitHub is connected, you can toggle **Auto-close tickets on PR merge** in the
   same settings panel to move Review cards into Done automatically once their linked PRs are merged.
- The server runs a lightweight scheduler that inspects Review cards with a `prUrl`, checks whether the PR is closed + merged,
   and quietly advances the card to Done so you do not have to move it manually.
- To keep a specific card in Review even after the PR is merged, set its `disableAutoCloseOnPRMerge` flag so the scheduler skips
   that card while still auto-closing others.
