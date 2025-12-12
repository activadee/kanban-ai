# Agents & profiles

Last updated: 2025-11-29

## Agent registry

- The server exposes a pluggable **Agents** module responsible for:
  - Defining the `Agent` interface (capabilities, configuration).
  - Registering concrete agents (e.g. Codex via SDK and local CLI).
  - Emitting events so the UI can stay in sync with the available agents.
- Registry behavior:
  - `registerAgent` adds an agent and emits `agent.registered`.
  - `bindAgentEventBus` publishes the full registry when the event bus becomes available.
- In the current implementation:
  - The UI focuses on a Codex-based agent backed by the Codex SDK and local Codex CLI.
  - OpenCode is now a first-class SDK-backed agent exposed via the API and `/agents` endpoints.
  - Droid remains experimental and is not exposed in the UI.

## Coding agents

KanbanAI’s agent registry is designed to host multiple **coding agents**. Today, the primary supported agents are
Codex and OpenCode, with additional agents under active development.

- **Codex**
  - Status: **Supported** (primary coding agent).
  - Implementation:
    - Backed by the Codex SDK and local Codex CLI.
    - Exposed in the UI (e.g. `/agents/CODEX`) and used for all production Attempts by default.
  - Capabilities:
    - Reads and writes files inside attempt worktrees.
    - Runs dev scripts and tools via the Attempts/runner pipeline.
    - Streams structured messages (steps, logs, diffs, suggestions) that power the Messages, Processes, and Logs views.
  - Configuration:
    - Tuned via agent profiles (model, temperature, tools/sandbox config) stored per project or globally.
    - Supports `modelReasoningEffort` (`minimal` | `low` | `medium` | `high` | `xhigh`) to control how much reasoning the Codex backend performs; higher levels, especially `xhigh`, typically trade higher latency and token usage for more robust planning and analysis.

- **Droid** (WIP)
  - Status: **Work in progress – not exposed in the UI, not supported for production use.**
  - Implementation:
    - Experimental agent module wired into the registry only in development builds.
    - Shares the same Attempt lifecycle and worktree model as Codex.
  - Intended goals:
    - Explore alternative planning/execution strategies and sandboxes.
    - Validate multi-agent orchestration patterns before promoting to a supported agent.

- **OpenCode**
  - Status: **Supported** (SDK-backed coding agent).
  - Implementation:
    - Backed by the official `@opencode-ai/sdk` client.
    - Uses the OpenCode HTTP API for sessions, messages, and events.
    - Can talk either to a local `opencode serve` instance (managed via the SDK) or to a remote OpenCode server when a
      base URL is configured (via `baseUrl` in the profile or `OPENCODE_BASE_URL`).
  - Capabilities:
    - Reads and writes files inside attempt worktrees via OpenCode tools.
    - Streams structured messages, tool invocations, and todos into KanbanAI’s Attempt model.
    - Implements the unified inline interface for:
      - `kind = "ticketEnhance"` – inline ticket enhancement.
      - `kind = "prSummary"` – PR inline summary/title+body drafting.
  - Configuration:
    - Tuned via agent profiles (primary model/agent selection, append/inline prompts, optional base URL / API key).
    - Providing `baseUrl` (or `OPENCODE_BASE_URL`) switches the agent into remote mode while `apiKey` is mirrored into
      `OPENCODE_API_KEY` when the SDK runs the local server, keeping credentials inside the profile without extra env setup.

Until additional WIP agents are promoted, **Codex and OpenCode are considered stable**. New features and UI flows
should continue to target these as the default coding agents, with Droid reserved for internal testing and
experimentation.

### Inline tasks & ticket enhancement

- Agents can optionally implement a unified inline interface:
  - `inline(kind, input, profile, opts?)` alongside `run` / `resume`.
  - `kind` is an `InlineTaskKind` such as:
    - `'ticketEnhance'` – current ticket enhancement flow (Title + Description enhancement).
    - `'prSummary'` – PR inline summary (Create Pull Request dialog suggestions and checklisted in `docs/core/pr-inline-summary.md`).
    - `'prReview'` – reserved for future PR review/analysis features.
  - `input`/`result` shapes are mapped via `InlineTaskInputByKind` / `InlineTaskResultByKind`.
    - For `ticketEnhance`, these map directly to `TicketEnhanceInput` / `TicketEnhanceResult`.
  - `opts.context` is an `InlineTaskContext` providing:
    - `projectId`, `boardId`, `repositoryPath`, `baseBranch`.
    - Optional branch/commit metadata and the effective `agentKey` / `profileId`.
  - `opts.signal` is an optional `AbortSignal` used to cancel the inline task.
- Ticket enhancement is implemented as a specific inline task:
  - Typical use cases:
    - Enriching an imported GitHub issue before it becomes a KanbanAI card.
    - Rewriting terse card titles/descriptions with additional acceptance criteria before an Attempt starts.
  - Helper utilities:
    - `core/agents/utils#splitTicketMarkdown(markdown, fallbackTitle, fallbackDescription)` extracts a leading H1 (`# `)
      from LLM output, making it easier for agents to return Markdown while still conforming to the required result shape.
    - `core/agents/utils#buildTicketEnhancePrompt(input, appendPrompt)` builds a standardized English-language prompt for
      ticket enhancement, used by agents like DROID and CODEX so they can share the same Markdown contract (H1 title,
      detailed body, and at least one `mermaid` diagram).
    - `TicketEnhanceInput` / `TicketEnhanceResult`, `InlineTaskKind`, `InlineTaskContext`, and the inline task maps are
      exported from `core/agentTypes` (via `core/src/index.ts`) so custom agents can share the same types without
      reaching into private modules.

### Core inline orchestrator and inline tasks

- The core layer exposes:
  - `runInlineTask({agentKey, kind, input, profile, context, signal?})` from `core/agentInline` (via `core/src/index.ts`)
    as the reusable inline orchestrator.
  - `agentEnhanceTicket(opts)` from `core/agentEnhanceTicket` (via `core/src/index.ts`) as the single entrypoint for ticket enhancement.
  - `agentSummarizePullRequest(opts)` from `core/agentSummarizePullRequest` (via `core/src/index.ts`) as the entrypoint for PR summaries.
- `runInlineTask` behavior:
  - Resolves the agent via the registry and validates that it implements `inline`.
  - Delegates to `agent.inline(kind, input, profile, {context, signal})`.
  - Normalizes errors into `InlineTaskError` with `kind`, `agent`, `code`, and `message`:
    - `UNKNOWN_AGENT`, `AGENT_NO_INLINE`, `INLINE_TASK_FAILED`, `ABORTED`.
- `agentEnhanceTicket` behavior:
  - Inputs: `projectId`, optional `boardId`, `title`, `description`, optional `agentKey`, optional `profileId`, and an
    optional `AbortSignal`.
  - Resolves `boardId`, `agentKey`, and `profileId` from project settings and inputs:
    - Uses the explicit `agentKey` / `profileId` when provided.
    - Otherwise consults the per-inline-agent profile mapping for `InlineAgentId = "ticketEnhance"` when configured so ticket enhancement can use a dedicated profile.
    - Otherwise uses the project’s configured inline agent/profile by default when set.
    - Otherwise falls back to the project’s default agent/profile (or `"DROID"` when no default agent is set).
    - Allows advanced callers to override `agentKey` / `profileId` explicitly.
  - Constructs a `TicketEnhanceInput` (including a cancellation signal) and `InlineTaskContext`.
  - Resolves the agent profile using the shared profile resolution helpers.
  - Supports specialized inline profiles:
    - Agent profile configs may define an `inlineProfile` string used primarily for inline responses (e.g. ticket enhancement),
      and for OpenCode it also acts as the main system prompt when present.
    - When `inlineProfile` is non-empty, inline prompts prefer it; otherwise they fall back to the primary profile prompt
      (such as `appendPrompt`), preserving existing behavior by default.
  - Annotates the inline context with `profileSource: "inline" | "primary"` so downstream telemetry can see whether the
    inline or primary profile drove a given request.
  - Invokes `runInlineTask({kind: 'ticketEnhance', ...})` and returns the resulting `TicketEnhanceResult`.
  - The server layer should call this function instead of wiring agents, profiles, and settings manually.
  - `POST /projects/:projectId/tickets/enhance` (Projects router) is the HTTP surface area: it validates `{title, description?, agent?, profileId?}` payloads, forwards them into `agentEnhanceTicket`, and returns `{ticket}` or RFC 7807 errors so the client can enrich cards without bespoke agent wiring.

- `agentSummarizePullRequest` behavior:
  - Inputs: `projectId`, required `headBranch`, optional `baseBranch`, optional `agentKey`, optional `profileId`, optional `attemptId`/`cardId` for linked GitHub issues, and an optional `AbortSignal`.
  - Resolves `agentKey` and `profileId` from project settings and inputs using the same rules as ticket enhancement:
    - Uses the explicit `agentKey` / `profileId` when provided.
    - Otherwise consults the per-inline-agent profile mapping for `InlineAgentId = "prSummary"` when configured so PR summaries can use a dedicated profile.
    - Otherwise prefers the project’s configured inline agent/profile when set.
    - Otherwise falls back to the project’s default agent/profile (or `"DROID"` when no default agent is set).
    - Allows advanced callers to override `agentKey` / `profileId` explicitly.
  - Loads the project and settings (including `repositoryPath` and `baseBranch`) and constructs a `PrSummaryInlineInput`:
    - `repositoryPath`, `baseBranch`, `headBranch`, plus optional change summaries in the future.
  - Resolves the agent profile using the shared profile resolution helpers, including support for inline-specific prompts via `inlineProfile`.
  - Builds an `InlineTaskContext` annotated with `profileSource: "inline" | "primary"` so downstream telemetry can distinguish which prompt was used.
  - Invokes `runInlineTask({agentKey, kind: 'prSummary', input, profile, context, signal})`, appends an auto-close line like `closes #123` when linked GitHub issues exist (or fully-qualified `owner/repo#123` when the PR repo is unknown), and returns the resulting `PrSummaryInlineResult` `{title, body}` used to populate PR title/body suggestions in the UI. When both `cardId` and `attemptId` are supplied, `cardId` wins and mismatches are treated as errors by the server.

## Profiles: configuration for agents

- **Agent profiles** capture reusable configuration for a specific agent, such as:
  - Model and sampling parameters.
  - Tool/sandbox settings.
  - Any agent-specific options encoded as JSON.
- Profiles are stored in SQLite and managed through the `core/agents/profiles` service:
  - `listAgentProfiles(projectId)`
  - `getAgentProfile(projectId, id)`
  - `createAgentProfile(projectId, agent, name, config)`
  - `updateAgentProfile(projectId, id, patch)`
  - `deleteAgentProfile(projectId, id)`
- Each create/update/delete operation emits `agent.profile.changed` so caches and UI views can refresh.

### Global vs project profiles

- Profiles can be scoped:
  - **Per project** – associated with a specific project’s ID.
  - **Global** – workspace-wide entries (IDs beginning with `apg-`).
- The UI surfaces both:
  - The Dashboard and settings pages expose an Agents view (e.g. `/agents/CODEX`) where profiles can be created and
    edited.
  - When starting or following up on an Attempt, the “profile” selector shows relevant profiles from both scopes.

## How Attempts use agents and profiles

- When a new Attempt is started or resumed:
  - The Attempts service resolves which agent to use from:
    - The explicit agent selected in the UI, or
    - The project’s default agent setting.
  - If a profile ID is provided (or a project default profile is configured), the service:
    - Loads the profile.
    - Validates it against the agent’s schema.
    - Applies the configuration to the agent runner.
- Behavior on invalid/missing profiles:
  - If a referenced profile is missing or fails validation, KanbanAI logs a warning.
  - The Attempt falls back to the agent’s default profile so work can continue without manual cleanup.
- During execution:
  - Agents implement `run` and `resume` and stream structured messages back via callbacks.
  - The Attempts module translates these into `attempt.*` events and persists logs + conversation items, powering the
    Messages, Processes, and Logs tabs in the UI.
