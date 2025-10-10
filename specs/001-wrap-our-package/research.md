# Phase 0 Research — Runner integration and CLI extraction

## Decision 1: Create a dedicated `cli/` workspace and move CLI bootstrap out of `server/`
- Rationale: Separates HTTP app construction (`createApp`) from process bootstrap (flags, serve, help/version). Improves boundaries, testing, and publishability.
- Alternatives considered:
  - Keep CLI inside `server/src/app.ts`: rejected due to tight coupling and harder publish story.
  - Add thin wrapper importing `server/src/app.ts` as‑is: rejected because `server/src/app.ts` mixes app factory and `import.meta.main` side effects.

## Decision 2: Expose a `bin` that selects the correct prebuilt binary from `dist/`
- Rationale: Aligns with existing packaging scripts that emit platform‑specific artifacts to `dist/`. Ensures fast startup and no toolchain requirement for end users.
- Alternatives considered:
  - Compile at install time: slower, flaky on CI/air‑gapped hosts.
  - Ship only JS and run via runtime: undermines “binary in dist” requirement and slower cold starts.

## Decision 3: Maintain argument/stdio/exit‑code parity between runner → wrapper → binary
- Rationale: Required for automation and CI reliability.
- Alternatives considered: None (baseline requirement).

## Decision 4: Keep `server` as a library exporting `createApp` and related routers/adapters
- Rationale: Preserves server composability and testing; reduces the public surface of `cli/` to process responsibilities only.
- Alternatives considered: Duplicate logic in `cli/`: rejected due to duplication risk.

## Decision 5: Documentation and quickstart
- Rationale: Provide a single quickstart demonstrating runner invocation, argument pass‑through, and troubleshooting when binary is missing.
- Alternatives considered: Inline README notes only: insufficient for repeatable usage.

## Open Questions resolved
- Where does the CLI live? → New `cli/` workspace, `src/main.ts`.
- How does the runner find the binary? → `bin` wrapper resolves platform‑specific file in `/dist` shipped with the package.
- What happens if artifact missing? → Wrapper prints actionable error with remediation steps (build locally or install a platform release) and exits non‑zero.

## Implementation notes for later phases (non‑binding)
- Update root `package.json` scripts that reference `server/src/app.ts` to point to `cli/src/main.ts` for packaging.
- Ensure the publish config includes `dist/**` and the `bin` wrapper.
- Add minimal tests for wrapper argument forwarding and exit code parity.
