# Security Policy

## Git Worktrees Security Architecture

KanbanAI implements a defense-in-depth approach to secure Git worktree operations. This document describes the security model, implemented mitigations, and residual risks.

### Threat Model

**Target Environment**: Local desktop application  
**Attack Vectors**:
- Path traversal attacks
- Command injection via git arguments
- Symlink-based TOCTOU (Time-of-Check Time-of-Use) attacks
- Resource exhaustion

**Out of Scope**:
- Network-based attacks (not a web service)
- Multi-tenant isolation (single-user application)
- Physical access attacks

### Security Layers

#### 1. Path Validation (`server/src/security/worktree-paths.ts`)

**Purpose**: Validate that all worktree paths are within the designated worktrees root.

**Mitigations**:
- Resolve symlinks via `realpath()` before validation
- Use cross-platform path containment checks (`path.relative()`)
- Reject absolute paths outside worktrees root
- Block path traversal patterns (`..`, `./`, etc.)

**Residual Risks**:
- **TOCTOU Race Condition**: Between `realpath()` resolution and actual filesystem operation, a symlink could be replaced
- **Impact**: Low (requires local filesystem access + microsecond-precision timing)
- **Mitigation**: Minimize time between validation and use; user education

#### 2. Git Argument Validation (`server/src/security/git-args.ts`)

**Purpose**: Prevent command injection through git command arguments.

**Mitigations**:
- Whitelist of allowed git commands (`rev-parse`, `worktree`, `fetch`, `push`, `status`)
- Whitelist of allowed flags per command
- Validation of flag values for commands requiring them
- Detection of dangerous patterns: `-c`, `--exec`, command substitution (`$()`, backticks), shell metacharacters

**Protections**:
- Blocks arbitrary command execution via git config (`-c`)
- Prevents upload/receive pack injection
- Rejects shell command injection attempts
- Validates both flag and non-flag arguments

#### 3. Directory Size Calculation (`server/src/worktrees/worktrees.service.ts`)

**Purpose**: Prevent resource exhaustion from directory size queries.

**Mitigations**:
- Native Node.js directory traversal (no shell commands)
- Configurable depth limit (default: 10 levels)
- File count limit (default: 10,000 files)
- Timeout protection (default: 30 seconds)
- Overflow protection for size calculations (max safe integer)
- Symlink detection and skipping

**Protections**:
- Eliminates TOCTOU from `du` command approach
- Bounds computational resources
- Prevents infinite loops from circular symlinks

#### 4. Deletion Safety

**Purpose**: Prevent accidental or malicious deletion of critical directories.

**Mitigations**:
- Explicit root directory check before validation
- Verification that path is within project worktree folder
- Require presence of `.git` file (worktree marker)
- Use `force: false` in `rm()` operations
- Distinguish between "doesn't exist" and "cannot delete" errors

**Protections**:
- Cannot delete worktrees root directory
- Cannot delete directories outside project scope
- Gracefully handles already-deleted directories

### Inherent Limitations

#### TOCTOU (Time-of-Check Time-of-Use) Vulnerabilities

**Nature of the Problem**:
Userspace JavaScript/Node.js applications cannot atomically validate and operate on filesystem paths. There is always a window between:
1. Validation: `realpath()` resolves symlinks, `validateWorktreePath()` checks containment
2. Use: `spawn()` with `cwd:`, `rm()`, `readdir()`, etc.

During this window, an attacker with local filesystem access could:
- Replace a validated symlink with a malicious one
- Swap directory contents
- Create race conditions in file operations

**Why This Cannot Be Fully Prevented**:
- Node.js `fs` module does not provide atomic "validate-then-operate" primitives
- Even `fchdir()` + relative paths don't prevent all races
- Kernel-level protection (e.g., `O_NOFOLLOW` in `openat()`) requires native code or future Node.js APIs

**Realistic Risk Assessment**:
- **Likelihood**: Very low in target environment
  - Requires local filesystem access (already compromised)
  - Requires microsecond-precision timing
  - User must trigger the vulnerable operation during attack window
- **Impact**: Medium
  - Could read/write files outside worktrees root
  - Cannot escalate privileges (Node.js runs as user)
  - Limited by user's existing permissions

**Compensating Controls**:
1. Minimize time between validation and use (kept to milliseconds)
2. User education: Don't run KanbanAI in hostile environments
3. Operating system protections (file permissions, sandboxing)
4. Logging of all filesystem operations for audit trails

### Best Practices for Users

1. **Run in Trusted Environments**:
   - Don't run KanbanAI on shared multi-user systems
   - Avoid running with elevated privileges

2. **File Permissions**:
   - Ensure worktrees root (`~/.cache/kanban-ai/worktrees/`) has appropriate permissions (e.g., `700`)
   - Don't symlink worktrees root to sensitive directories

3. **Monitor for Anomalies**:
   - Review application logs for unexpected path rejections
   - Check for unexpected symlinks in worktrees directories

### Reporting Security Issues

If you discover a security vulnerability, please report it to:
- **Email**: security@kanbanai.example.com (if available)
- **GitHub**: Open a private security advisory

**Please do not open public issues for security vulnerabilities.**

### Security Update Policy

- Security patches will be released as soon as possible after verification
- Users will be notified via GitHub releases and security advisories
- Critical vulnerabilities will trigger immediate patch releases

### Acknowledgments

This security architecture was developed through eight rounds of security reviews, addressing:
- Path traversal vulnerabilities
- Command injection vectors
- TOCTOU race conditions
- Resource exhaustion risks

Special thanks to the security reviewers who helped identify and mitigate these issues.

---

**Last Updated**: 2026-01-03  
**Security Architecture Version**: 8.0
