# Phase 1 — Data Model (CLI extraction)

This feature introduces no new persistent domain data. The data model below captures transient runtime entities to guide testing and contracts.

## Entities

- CLIInvocation
  - description: A single invocation of the published CLI via the runner
  - fields:
    - args: string[] — ordered arguments passed by the caller
    - env: Record<string, string> — environment variables visible to the process
    - cwd: string — working directory from which the command is called

- BinarySelector
  - description: Resolver that maps (platform, arch) → artifact path under `dist/`
  - fields:
    - platform: 'linux' | 'darwin' | 'win32'
    - arch: 'x64' | 'arm64'
    - resolvedPath: string | null — absolute path to binary if found

- ExecutionResult
  - description: Outcome of invoking the selected artifact
  - fields:
    - exitCode: number — exact code returned by underlying process
    - stdout: string — captured standard output (for tests)
    - stderr: string — captured standard error (for tests)

## Relationships

- CLIInvocation uses BinarySelector to resolve the artifact path.
- On success, CLIInvocation yields an ExecutionResult with parity to the underlying process.

## Validation Rules

- Arguments are forwarded unchanged (no mutation or re‑ordering).
- Non‑zero exit codes propagate unchanged to the caller.
- If the artifact cannot be resolved, a human‑readable error is produced and exit code is non‑zero.
