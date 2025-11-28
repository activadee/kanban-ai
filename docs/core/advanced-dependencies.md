---
title: Task dependencies
---

# Task dependencies

## Overview

Task dependencies let you express that one card “blocks” another on the same board. This helps prevent work from
starting on tasks that are not yet unblocked.

## Data model

- Dependencies are stored in the `card_dependencies` table with:
  - `card_id` – the card that depends on another.
  - `depends_on_card_id` – the card it depends on.
- The `core/projects/dependencies` helpers manage:
  - Reading dependencies for a card or set of cards.
  - Setting dependencies (replacing the full set).
  - Checking whether a card is blocked.

## Rules and validation

When you call `setDependencies(cardId, dependsOnIds)`:

- All dependencies must be on the same board as the target card:
  - The helper resolves the board for `cardId` and each dependency.
  - If any dependency is on a different board, it throws `dependency_board_mismatch`.
- Cycles are prevented:
  - The helper builds a graph of dependencies for the board and runs a cycle check.
  - If adding the new dependencies would introduce a cycle, it throws `dependency_cycle`.
- Duplicate or self-dependencies are filtered out:
  - The list is de-duplicated.
  - Any `cardId` that equals the target card is removed.

## Blocked cards and moves

Whether a card is considered **blocked** depends on the status of its dependencies:

- `isCardBlocked(cardId)`:
  - Loads dependency IDs for the card.
  - For each dependency:
    - If the card is missing or its column title (case-insensitive) is not **Done**, it counts as incomplete.
  - Returns `{ blocked: boolean, incompleteDependencyIds: string[] }`.

The board handlers use this when moving cards:

- When you try to move a card into an **In Progress** column:
  - The server calls `isCardBlocked(cardId)` before performing the move.
  - If `blocked` is `true`, the API returns HTTP `409` with `detail: "Task is blocked by dependencies"`.
  - The client shows a helpful message explaining why the move failed.

## UI behavior

- The card inspector lets you see and edit dependencies (typically as a list of other cards).
- Blocked cards:
  - Can still move between non-In Progress columns.
  - Cannot move into In Progress until all dependencies are in Done.
  - Are surfaced in the UI with toasts or inline messaging when a move is rejected.

See also:

- `core/kanban-boards-and-tasks.md` for how dependencies integrate with board state.
