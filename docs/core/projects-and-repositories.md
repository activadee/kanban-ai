# Projects & repositories

Last updated: 2025-11-28

## What a project is

- A **project** represents a single local Git repository and acts as the workspace for:
  - One kanban board (Backlog → In Progress → Review → Done).
  - Attempts (agent runs) tied to cards on that board.
  - Project-scoped settings, agent profiles, and GitHub integration.
- On the backend, project and board data live in SQLite via Drizzle. The Projects and Tasks modules emit events
  (`project.*`, `board.state.changed`, `attempt.*`) so other services and the UI can react without tight coupling.

## Creating projects

### From an existing repository

- The project creation flow lets you point KanbanAI at an existing Git repository on disk.
- The server exposes a filesystem API:
  - `GET /fs/git-repos?path=/optional/base/path`
  - Backed by the Filesystem module’s `discoverGitRepositories` helper in `core`, which returns
    `GitRepositoryEntry { name, path }` records.
- The client uses this endpoint to implement repository discovery in the “create project” dialog:
  - You can browse or search for Git repositories.
  - Selecting one wires its `repositoryPath` into the new project.

### Blank projects (initialize a repo)

- You can also create a “blank” project, choosing a directory where KanbanAI will initialize a new Git repository.
- The Projects + Git modules:
  - Ensure the target directory exists.
  - Initialize a Git repository if needed.
  - Record the canonical `repositoryPath` for future Git operations and worktrees.

### Lifecycle events

- Project actions emit events that other modules listen to:
  - `project.created` – seeds the default board columns (Backlog, In Progress, Review, Done) and prepares filesystem
    structures.
  - `project.updated` – signals settings changes so caches can refresh.
  - `project.deleted` – triggers cleanup of associated boards, attempts, and worktrees (via Filesystem listeners).

## Project settings

Per-project settings are managed by the Projects module and stored in SQLite. They control how Attempts and Git behave for
that repository:

- **Base branch & remote**
  - Configure the primary branch Attempts should target (e.g. `main`).
  - Set the preferred Git remote used for pushes and PRs.
- **Ticket keys & naming**
  - Each project has a ticket key prefix and board slug so cards can be labeled like `ABC-123` in the UI.
- **Default agent & profile**
  - Choose which agent (e.g. Codex) is used when starting Attempts.
  - Optionally select a default agent profile to apply for new Attempts.
- **Inline agent & profile**
  - Choose which agent is used for inline actions such as ticket enhancement and PR summaries.
  - Optionally select a dedicated inline agent profile (per agent) used only for inline requests.
  - Define per-inline-agent profile mappings when you want different profiles for workflows like ticket enhancement,
    PR summary, or the future PR review inline kind.
- **Automation flags**
  - `autoCommitOnFinish` – when enabled, successful Attempts trigger `attempt.autocommit.requested`, which runs an
    auto-commit against the Attempt worktree.
  - `autoPushOnAutocommit` – when enabled in combination with the above, the auto-commit handler also pushes the branch
    to the preferred remote.

- **GitHub Issue Sync**
  - Enables a scheduled background sync that keeps board cards aligned with GitHub issues from the project's origin
    repository.
  - Settings exposed via `GET /projects/:projectId/settings` and `PATCH /projects/:projectId/settings` include
    `githubIssueSyncEnabled`, `githubIssueSyncState` (`open`/`all`/`closed`), and
    `githubIssueSyncIntervalMinutes` (clamped between 5 and 1440 minutes).
  - The sync pipeline respects the connection state and origin discovered for the project, stores `lastGithubIssueSyncAt`
    / `lastGithubIssueSyncStatus` timestamps, and logs each run with the `github:sync` scope (see
    `docs/core/github-integration.md`).

Project settings are available in the UI under each project’s **Settings** tab and surfaced via the Projects module’s
settings endpoints.

## APIs & types

Project-related APIs are rooted under `/api/v1`:

- `GET /projects` – list projects.
- `POST /projects` – create a project (existing or blank repository).
- `GET /projects/:projectId` – fetch a project and its board metadata.
- `GET /projects/:projectId/settings` – load per-project settings (ensuring defaults).
- `PATCH /projects/:projectId/settings` – update project settings (base branch, remote, defaults, inline agent/profile, per-inline-agent profile mapping for ticket enhancement/PR summary, automation flags).
- `POST /projects/:projectId/tickets/enhance` – ask the configured agent to rewrite a card’s title/description. Accepts `{title, description?, agent?, profileId?}` and returns `{ticket}` with the enhanced copy or RFC 7807 errors when enhancement fails.
- `GET /projects/:projectId/github/origin` – inspect GitHub origin information for the project repository.

Types for project payloads and filesystem responses (such as `GitRepositoryEntry`) are exported from the `shared` package
and reused across server and client.
