---
title: Ticket enhancement
---

# Ticket enhancement

## Overview

Ticket enhancement lets KanbanAI rewrite rough ticket drafts (title + description) using your configured agents before
you create or update a card. It is an inline operation: it does not create Attempts, branches, or commits; it simply
returns an improved draft that you can accept or ignore.

## UI behavior

### Create / Edit dialogs

- The **Create Ticket** and **Edit Ticket** dialogs show a small robot button next to the Description field labeled
  “Enhance ticket”.
- The button is:
  - Enabled only when the Title field is non-empty.
  - Disabled while an enhancement request is already in flight.
- When you click it:
  - The current title (trimmed) and description are sent to the server for enhancement.
  - The button shows a spinner while the request runs.
- On success:
  - An “AI suggestion preview” box appears below the form.
  - The preview shows Original vs Suggestion titles and descriptions side-by-side.
  - You can click **Accept** to apply the suggestion into the form, or **Reject** to discard it and keep your original
    text.
  - After Accept/Reject you can click Enhance again to request a new suggestion.
- Enhancement never saves the card on its own:
  - For new tickets you still need to click **Create Ticket**.
  - For existing tickets you still need to click **Save Changes**.

## API surface

The UI and integrations use a dedicated enhancement endpoint:

- `POST /projects/:projectId/tickets/enhance`
  - Request body:
    - `title` (string, required).
    - `description` (string, optional, defaults to empty when omitted).
    - `agent` (string, optional agent key override).
    - `profileId` (string, optional profile ID override).
  - Successful response (`200 OK`):
    - `{ "ticket": { "title": "...", "description": "..." } }`
- Error handling:
  - Unknown or missing project → `404` problem response.
  - Unknown agent key or agent without ticket-enhancement support → `400` problem response.
  - Internal errors in the enhancement pipeline → `502` problem response with a generic `"Failed to enhance ticket"`
    message.
- The endpoint is pure transformation:
  - It does not create, update, or persist cards.
  - Callers are expected to copy any accepted suggestion into their own form state and save via the normal card APIs.

## Agent pipeline

Under the hood, ticket enhancement is orchestrated by `agentEnhanceTicket` in the core layer, implemented as a generic
inline task with `kind = "ticketEnhance"`:

- Input options:
  - `projectId`, optional `boardId`.
  - `title`, `description`.
  - Optional `agentKey`, optional `profileId`, optional `AbortSignal`.
- Behavior:
  - Loads the project and its settings (including `baseBranch`, `inlineAgent`, `inlineProfileId`).
  - Resolves an effective `boardId` from the provided value, the project board, or the project ID.
  - Chooses an agent:
    - Uses the explicit `agentKey` when provided (for advanced integrations).
    - Otherwise uses the project’s configured `inlineAgent`.
    - If neither is available, `agentEnhanceTicket` throws an error:
      - `"No inline agent configured for this project. Configure one in Project Settings."`
  - Validates that the agent exists and supports inline ticket enhancement, throwing errors for:
    - `Project not found`.
    - `Unknown agent: <KEY>`.
    - `Agent <KEY> does not support ticket enhancement`.
  - Constructs:
    - A `TicketEnhanceInput` containing project/board identifiers, repository path, base branch, title, description,
      profile ID, and a cancellation signal.
    - An `InlineTaskContext` with project, repo, branch, and agent/profile metadata.
  - Resolves an agent profile:
    - Uses the explicit `profileId` when provided.
    - Otherwise, when using the project’s `inlineAgent`, prefers the project’s configured `inlineProfileId`.
    - Falls back to the agent’s default profile when the configured profile is missing or invalid.
  - For inline requests, prefers an agent’s inline profile prompt (when configured) over the primary profile prompt:
    - If the resolved profile contains `inlineProfile`, it is used to tailor the ticket-enhancement prompt.
    - Otherwise, the primary profile’s prompt (e.g. `appendPrompt`) is used as before.
  - Annotates the inline context with `profileSource: "inline" | "primary"` so telemetry can distinguish which prompt was used.
  - Invokes `runInlineTask({agentKey, kind: "ticketEnhance", input, profile, context, signal})`.
  - Returns the `TicketEnhanceResult` (rewritten title + description) to the caller.

## When to use ticket enhancement

- Turning terse titles into fuller tickets with acceptance criteria before starting an Attempt.
- Cleaning up imported GitHub issues or backlog items without touching the underlying repository.
- Giving non-technical stakeholders a simple “Improve this ticket” button while keeping full control over what actually
  gets saved.

For implementation details on agents, profiles, and the enhancement contract, see `core/agents-and-profiles.md`.
