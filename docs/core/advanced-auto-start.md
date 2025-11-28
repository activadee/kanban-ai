# Advanced: auto-start agent on In Progress

Last updated: 2025-11-28

## Overview

Auto-start lets KanbanAI automatically start an Attempt whenever a card is moved from **Backlog** to **In Progress**,
using the project’s default agent/profile.

## Configuration

- Global toggle:
  - Exposed in App Settings as **Auto-start agent on In Progress**.
  - Stored in the singleton settings row managed by the Settings module.
- Per-project defaults:
  - Projects can specify:
    - A default agent key.
    - An optional default profile ID.

Auto-start only triggers when both:

- The global auto-start toggle is enabled, and
- The project has a default agent configured.

## Event flow

The behavior is implemented in the Tasks listeners:

- Listener subscribes to `card.moved` events.
- On each move:
  - It resolves the target column’s title and normalizes it.
  - If the target column is not **In Progress**, it returns early.
  - It ensures global app settings are loaded and checks `autoStartAgentOnInProgress`.
  - It fetches project settings for the board:
    - If there is no default agent, it returns.
  - It checks the latest Attempt for the card:
    - If there is an Attempt in `running`, `queued`, or `stopping` status, it returns.
  - Otherwise, it calls `startAttempt` with:
    - `boardId`, `cardId`.
    - The project’s default agent.
    - The project’s default profile ID, if set.

## UX implications

- When enabled, moving a card from Backlog → In Progress:
  - Immediately queues an Attempt and moves the card into active work.
  - Keeps the board in sync with actual agent activity.
- Teams that prefer manual control can:
  - Leave auto-start disabled.
  - Start Attempts explicitly from the card inspector instead.

See also:

- `core/quality-of-life.md` for related automation and realtime updates.
- `core/ai-attempts.md` for Attempt lifecycle details.

