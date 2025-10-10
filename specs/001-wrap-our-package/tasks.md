# Tasks: Wrap package for runner and extract CLI entry

**Input**: Design documents from `/specs/001-wrap-our-package/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Optional. Not explicitly requested in spec — no test tasks included. Each story lists independent test criteria for manual/CI validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- [P]: Can run in parallel (different files, no dependencies)
- [Story]: US1, US2, US3 (from spec priorities)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

Purpose: Initialize new CLI workspace and wiring needed by all stories.

- [X] T001 [P] Create new workspace folder `cli/` with `cli/package.json` (name: `@kanbanai/cli` or private), set `type: module`, `main: dist/index.js` (placeholder), and dependency on `server` workspace.
- [X] T002 [P] Add `cli/tsconfig.json` extending root `tsconfig.json`; output to `cli/dist`.
- [X] T003 Update root `package.json` workspaces to include `./cli` and add scripts placeholders: `build:cli`, `dev:cli`.
- [X] T004 [P] Create entry file `cli/src/main.ts` (empty bootstrap placeholder; to be filled in Phase 2).
- [X] T005 [P] Create runner wrapper file `cli/bin/kanbanai.js` with shebang `#!/usr/bin/env node` and placeholder that logs "kanbanai wrapper (dev)".

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Extract bootstrap from `server/src/app.ts` into `cli/src/main.ts`; keep server as library only. This phase MUST complete before any user story can start.

- [X] T006 Move bootstrap logic from `server/src/app.ts` (the `if (import.meta.main) { ... }` block) into `cli/src/main.ts`, adapting imports to call server factory functions.
- [X] T007 Export `createApp` from `server/src/app.ts` only; remove direct process startup side‑effects from server file.
- [X] T008 Extract helper functions from server for reuse by CLI:
      - Create `server/src/runtime.ts` exporting `openBrowser`, `resolveMigrationsFolder`, and any other helpers used by bootstrap.
      - Update imports in `cli/src/main.ts` to import from `server/src/runtime.ts`.
- [X] T009 [P] Extract `registerClientRoutes` from `server/src/app.ts` into `server/src/client.ts` and export it; update `cli/src/main.ts` to `await registerClientRoutes(app)`.
- [X] T010 Update root packaging scripts in `package.json` to build CLI entry instead of server file:
      - Replace `bun build --compile server/src/app.ts --outfile dist/kanbanai` with `bun build --compile cli/src/main.ts --outfile dist/kanbanai`.
      - Update cross‑platform scripts (`package:server:*`) similarly to compile from `cli/src/main.ts`.
- [X] T011 [P] Ensure `server/package.json` keeps `dev` script working (`bun --watch run src/app.ts`) by guarding dev server start behind a new script or using `cli/src/main.ts` during dev where appropriate.
- [X] T012 [P] Verify types export surface: add named exports in `server/src/index.ts` if needed to re‑export `createApp`, `registerClientRoutes`, `resolveMigrationsFolder`, `openBrowser`.
- [X] T013 Wire Turbo tasks if necessary: confirm `turbo.json` patterns capture `cli/src/**` in inputs and `dist/**` in outputs (adjust if missing).

Checkpoint: Foundation ready — CLI entry exists outside server and builds successfully to `dist/kanbanai*`.

---

## Phase 3: User Story 1 — Start CLI via standard runner (Priority: P1) 🎯 MVP

Goal: Running the package via the standard runner (e.g., `bunx kanban-ai`) launches the packaged CLI binary from `dist/` with default output.

Independent Test: On a clean machine with only the runner installed, `bunx kanban-ai` prints a banner/help and starts the server without requiring a global install.

Implementation Tasks (US1)

- [X] T014 [US1] Map root `package.json` `bin` field to the wrapper: `{ "kanban-ai": "./cli/bin/kanbanai.js" }`.
- [X] T015 [P] [US1] Implement `cli/bin/kanbanai.js` to resolve platform/arch and locate the correct binary under `dist/`:
      - linux-x64: `dist/kanbanai-linux-x64`
      - linux-arm64: `dist/kanbanai-linux-arm64`
      - darwin-x64: `dist/kanbanai-darwin-x64`
      - darwin-arm64: `dist/kanbanai-darwin-arm64`
      - win32-x64: `dist/kanbanai-windows-x64.exe`
      - win32-arm64: `dist/kanbanai-windows-arm64.exe`
      - Fallback: `dist/kanbanai` if present.
- [X] T016 [US1] In wrapper, spawn the resolved binary with `stdio: 'inherit'` (temporarily ignore args for US1) and exit with the child’s status.
- [X] T017 [P] [US1] Ensure published files include binaries and wrapper: add `"files": ["dist/**", "cli/bin/**"]` to root `package.json` (or equivalent publish config).
- [X] T018 [US1] Update `/specs/001-wrap-our-package/quickstart.md` with runner invocation examples and default behavior.

Checkpoint: `bunx kanban-ai` launches the default CLI on supported platforms.

---

## Phase 4: User Story 2 — Argument and exit‑code parity (Priority: P2)

Goal: All arguments after the package name pass through unchanged to the underlying CLI; exit code equals the child process exit code.

Independent Test: `bunx kanban-ai --port 5555 --open` starts on port 5555 and opens a browser; running a command path that fails returns a matching non‑zero exit code.

Implementation Tasks (US2)

- [X] T019 [US2] Update `cli/bin/kanbanai.js` to pass `process.argv.slice(2)` to the child.
- [X] T020 [US2] Ensure the wrapper exits with the child’s exact exit code and propagates signals (SIGINT/SIGTERM) to the child.
- [X] T021 [P] [US2] Verify stdout/stderr parity: wrapper must not intercept/transform streams; use `stdio: 'inherit'`.
- [X] T022 [US2] Document argument examples in `quickstart.md` (forwarding semantics, exit code parity statement).

Checkpoint: Scripts and CI can rely on pass‑through arguments and exit code parity.

---

## Phase 5: User Story 3 — Helpful feedback on failure (Priority: P3)

Goal: If the binary cannot be found or the platform is unsupported, the wrapper prints a clear, actionable error with remediation steps.

Independent Test: Temporarily rename/remove `dist/kanbanai*` and confirm the wrapper prints a helpful message with next steps and exits non‑zero.

Implementation Tasks (US3)

- [X] T023 [US3] Add explicit checks in `cli/bin/kanbanai.js` for resolved path existence; on missing file, print error: platform, expected path, and remediation (build locally via `bun run package` or download a release).
- [X] T024 [P] [US3] Detect unsupported `process.platform`/`process.arch` combinations and print a friendly message including supported pairs.
- [X] T025 [US3] Ensure errors go to stderr and wrapper exits with code `1`.
- [X] T026 [US3] Add a Troubleshooting section to `quickstart.md` covering missing artifact and unsupported environment.

Checkpoint: Users receive actionable feedback in failure scenarios without stack traces.

---

## Phase N: Polish & Cross‑Cutting

- [X] T027 [P] Review `server/src/app.ts` for dead code after extraction and remove unused imports/exports.
- [X] T028 [P] Update `README.md` with a short section on running via the package runner.
- [X] T029 Validate packaging matrix by running `bun run package:all` and smoke‑running the wrapper for each output locally where possible. (Replaced with CI matrix workflow `.github/workflows/build-binaries.yml` building on Linux, macOS, Windows and uploading artifacts; release upload on tags.)
- [X] T030 [P] Ensure CI (if present) calls the wrapper instead of directly invoking binaries.

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) → US1 (Phase 3, MVP) → US2 (Phase 4) → US3 (Phase 5) → Polish.
- User stories are independent once Foundational is complete; US2 and US3 can run in parallel after US1 if team capacity allows.

### Story Dependencies
- US1 depends on Foundational completion.
- US2 depends on US1 (uses wrapper behavior) — can partially proceed after T015–T017.
- US3 depends on US1 (failure paths in wrapper).

### Parallel Opportunities
- [P] tasks within a phase can run concurrently (e.g., T002, T004, T005 in Setup; T009, T011–T013 in Foundational).
- After US1 wrapper baseline is in place, US2 (T019–T021) and US3 (T023–T025) can proceed in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (T001–T005)
2. Complete Foundational (T006–T013)
3. Implement US1 (T014–T018)
4. Validate with `bunx kanban-ai` on a clean environment

### Incremental Delivery
- Deliver US1 as MVP, then layer US2 (pass‑through parity) and US3 (helpful failures) without breaking existing flows.

---

## Summary Metrics
- Total tasks: 30
- Tasks per story: US1 = 5 (T014–T018), US2 = 4 (T019–T022), US3 = 4 (T023–T026)
- Parallelizable tasks: T002, T004, T005, T009, T011, T012, T013, T015, T017, T021, T024, T028, T030
- Independent test criteria: Defined at the start of each story phase (manual/CI verification without test tasks).
- Suggested MVP scope: Phase 3 (User Story 1) — runner launches binary from `dist/` with default output.
