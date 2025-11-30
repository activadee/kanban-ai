---
title: PR inline summary
---

# PR inline summary

## Overview

PR inline summary lets KanbanAI draft pull request titles and descriptions based on the changes between a base branch and a feature branch. It is an inline operation: it does not create Attempts, branches, or commits; it simply returns a suggested PR title/body that you can accept or ignore in the **Create Pull Request** dialog.

## UI behavior

- The **Create Pull Request** dialog shows a small robot button inside the Description field.
- The button is:
  - Enabled only when a branch is available for the PR.
  - Disabled while a summary request is already in flight.
- When you click it:
  - The current title/description and branch information are sent to the server for summarization.
  - The button shows a spinner while the request runs.
- On success:
  - An “AI suggestion preview” box appears below the form.
  - The preview shows Original vs Suggestion titles and descriptions side-by-side.
  - You can click **Accept** to apply the suggestion into the form, or **Reject** to discard it and keep your original text.
  - After Accept/Reject you can click the bot button again to request a new suggestion.
- Summarization never creates a PR on its own:
  - You still need to click **Create PR** to open the pull request on GitHub.

## API surface

The UI uses a dedicated summary endpoint:

- `POST /projects/:projectId/pull-requests/summary`
  - Request body:
    - `base` (string, optional) – base branch; when omitted, falls back to the project’s configured `baseBranch`.
    - `branch` (string, optional) – head branch; when omitted, the server uses the current git branch.
    - `agent` (string, optional agent key override).
    - `profileId` (string, optional profile ID override).
  - Successful response (`200 OK`):
    - `{ "summary": { "title": "...", "body": "..." } }`
- Error handling:
  - Unknown or missing project → `404` problem response.
  - Unknown agent key or agent without inline PR-summary support → `400` problem response.
  - Cancelled inline tasks → `499` problem response.
  - Internal errors in the summary pipeline → `502` problem response with a generic `"Failed to summarize pull request"` message.
- The endpoint is pure transformation:
  - It does not create, update, or persist PRs.
  - Callers are expected to copy any accepted suggestion into their own form state and then call the normal PR creation endpoint.

## Agent pipeline

PR summarization reuses the same inline infrastructure as ticket enhancement:

- Input options for `agentSummarizePullRequest`:
  - `projectId`, required `headBranch`, optional `baseBranch`.
  - Optional `agentKey`, optional `profileId`, optional `AbortSignal`.
- Behavior:
  - Loads the project and its settings (including `baseBranch`, `inlineAgent`, `inlineProfileId`).
  - Resolves an effective agent/profile:
    - Uses the explicit `agentKey` / `profileId` when provided.
    - Otherwise prefers the project’s configured `inlineAgent` / `inlineProfileId`.
    - When no inline agent is configured, falls back to the project’s `defaultAgent` / `defaultProfileId` (or `"DROID"` when none is set).
  - Constructs a `PrSummaryInlineInput` containing:
    - `repositoryPath`, `baseBranch`, `headBranch`, and optional change summaries.
  - Resolves the agent profile, preferring inline prompts:
    - If the resolved profile contains `inlineProfile`, it is used to tailor the PR-summary prompt.
    - Otherwise, the primary profile’s prompt (e.g. `appendPrompt`) is used.
  - Builds an `InlineTaskContext` annotated with `profileSource: "inline" | "primary"`.
  - Invokes `runInlineTask({agentKey, kind: "prSummary", input, profile, context, signal})`.
  - Returns `PrSummaryInlineResult` `{title, body}`.

## When to use PR inline summary

- Quickly drafting clear, consistent PR titles and bodies for feature branches.
- Encouraging richer PR descriptions (including diagrams) without manual boilerplate.
- Keeping inline behavior aligned with your chosen agent/profile, so ticket enhancement and PR summary share the same tuning.

For implementation details on agents, profiles, and inline tasks, see `core/agents-and-profiles.md` and `core/advanced-ticket-enhancement.md`.

