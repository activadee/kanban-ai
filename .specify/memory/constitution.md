<!--
Sync Impact Report
Version change: 1.1.0 → 1.2.0 (MINOR)
Modified principles: Boundaries → Architecture Boundaries (explicit: domain logic in core; shared for reusable cross‑package types; server as adapters)
Added sections: none (material expansion under Core Principles)
Removed sections: none
Templates reviewed:
  ✅ .specify/templates/spec-template.md (aligns; tech‑agnostic)
  ✅ .specify/templates/plan-template.md (aligns; Constitution Check remains valid)
  ✅ .specify/templates/tasks-template.md (aligns)
Other docs reviewed:
  ✅ README.md (no contradictions)
  ✅ AGENTS.md (consistent with CLI + CI guidance)
Deferred TODOs:
  - TODO(RATIFICATION_DATE): original adoption date not previously captured
-->

# KanbanAI Constitution

## Core Principles

### I. Code Quality Is Non‑Negotiable

All contributed code MUST be simple, readable, and maintainable within the existing monorepo layout (`client/`, `server/`, `shared/`, `core/`).

- Types: Public APIs are fully typed; `any` is disallowed except with an inline justification comment and the smallest possible scope.
- Lint & Types: Workspace lint and type‑check MUST pass before merge (`lint`, `type-check`, or their workspace equivalents).
- Architecture Boundaries:
  - Domain logic (entities, policies, orchestration/use cases) lives in `core/`.
  - `core/` exposes pure APIs and ports (interfaces). It MUST NOT perform network/FS/process side effects.
  - `server/` implements adapters (HTTP, DB, FS, processes, locks, auth) and application wiring that call `core/` through its public API/ports.
  - `shared/` is for reusable cross‑package assets (types, DTOs/schemas, minimal side‑effect‑free utilities). No domain logic or adapters belong in `shared/`.
  - Cross‑workspace coupling occurs via exported types/contracts in `shared/` and via `core/`’s public API only.
  - CLI process/bootstrap lives in `cli/`; `server/` exposes factories/helpers only (no `import.meta.main`).
- Small, focused changes: Prefer incremental PRs with a single responsibility and clear rationale.
- Dead code and unused exports are removed as they are encountered.

Rationale: Upholding clear boundaries and strong typing prevents regressions and accelerates iteration in a multi‑package repo.

### II. Testing Standards Protect Velocity

Tests validate behavior at the level where defects would be cheapest to detect. The `core/` workspace currently enforces measured coverage and acts as the baseline for other critical logic.

- Unit coverage thresholds (core): lines ≥ 85%, statements ≥ 85%, functions ≥ 80%, branches ≥ 60% (enforced via coverage config and summary checks).
- Per‑module health (core): module roll‑ups MUST meet lines/statements ≥ 85% as reported by the coverage summary checker.
- Critical paths: Board operations, Git operations, attempt lifecycle, and settings logic MUST include unit and/or integration tests when changed or added.
- Regressions: A failing test reproducing a defect MUST be added before the fix.
- Client tests: Complex UI state or logic (drag/drop ordering, dialogs with destructive actions) SHOULD include focused tests; visual style is verified via review, not tests.

Rationale: Enforcing meaningful coverage on core logic preserves confidence without forcing superficial tests elsewhere.

### III. User Experience Consistency

User‑facing work MUST conform to the existing design tokens and component conventions in `client/`.

- Components: Prefer primitives in `client/src/components/ui/*`; compose higher‑level components in `components/common` before adding new primitives.
- Theming: Use CSS tokens defined in `client/src/index.css` (e.g., `bg-background`, `text-foreground`); support light/dark automatically.
- Accessibility: Interactive elements have labels, focus states are visible, and keyboard paths are preserved; avoid title‑only affordances.
- Feedback: Use toast notifications for ephemeral status; use dialogs/drawers for confirmation and multi‑step flows; avoid blocking alerts.
- Empty/loading states: Provide helpful empty states and progressive feedback for long actions.

Rationale: Consistency reduces cognitive load, improves learnability, and lowers maintenance costs.

### IV. Performance Requirements Serve the UX

Performance targets are expressed as user‑perceived outcomes and reliability expectations.

- Responsiveness: Common board actions (create, move, update, delete) complete with visible confirmation within 300 ms p95 on a typical developer laptop with local server.
- Realtime: WebSocket sessions maintain a heartbeat; clients ping/pong at ~15 s and may be disconnected after ~2.5 min of silence to conserve resources.
- Startup: App landing views (Dashboard or last project) render usable content within 2 s on a cold start (local dev baseline).
- Efficiency: Background polling or timers MUST avoid excessive wake‑ups; prefer event‑driven updates.

Rationale: Framing targets around user perception keeps the system focused on outcomes rather than internal metrics.

## Quality Gates & Standards

The following gates MUST pass before merge for any PR that changes application code:

- Lint clean and type‑check clean across affected workspaces.
- Build succeeds for affected workspaces.
- Packaging: Host‑platform binary MUST build successfully from `cli/src/main.ts`. Cross‑platform artifacts are produced via CI matrix and MUST be uploaded as release assets on tagged builds.
- Tests run green for affected workspaces; when touching `core/`, coverage thresholds and per‑module checks pass.
- For user‑visible UI changes, screenshots or a short screencast SHOULD be attached in the PR description.
- Breaking UX or behavior changes require a brief “Why/Impact” note and visible release notes entry (in PR body or changelog file).

## Development Workflow & Review Process

- Small PRs, fast feedback: Prefer narrowly scoped PRs; large refactors are split into reviewable steps.
- Definition of Done: Gates above pass; reviewer confirms UX consistency and accessibility basics; rationale recorded in PR.
- Reviews focus on readability, boundary clarity, and risk. Coverage numbers inform but do not replace judgment.
- Exceptions: Any temporary deviations (e.g., coverage gaps, disabled lint rules) MUST include an owner and follow‑up issue.

## Release Packaging & Distribution

- Naming: Binaries follow `kanbanai-<os>-<arch>[.exe]` (linux|darwin|windows, x64|arm64). Generic fallback `dist/kanbanai` may exist.
- Wrapper: `cli/bin/kanbanai.cjs` resolves OS/arch to the correct artifact and forwards args/stdio/exit codes.
- CI: `.github/workflows/build-binaries.yml` builds on Ubuntu/macOS/Windows and uploads artifacts; tags starting with `v` publish a GitHub Release with binaries.

## Governance

- Authority: This Constitution supersedes ad‑hoc practices. Conflicts resolve in favor of this document.
- Amendments: Proposed via PR with a summary of impact, migration expectations (if any), and version bump.
- Versioning: Semantic for governance
  - MAJOR: Backward‑incompatible principle removals/redefinitions
  - MINOR: Added/expanded principle or section
  - PATCH: Clarifications without semantic change
- Compliance Reviews: During planning and PR review, maintainers verify gates and principles. Non‑compliant changes are blocked until addressed or explicitly excepted with owners and timelines.

**Version**: 1.2.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date not recorded | **Last Amended**: 2025-10-11

