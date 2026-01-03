---
name: pr-review
description: AI-powered pull request code review focusing on correctness, security, stability, and maintainability. Posts structured findings via submit_review tool.
license: MIT
metadata:
  trigger: pull_request
  tools: submit_review
---

## What I Do

Review pull request changes systematically and post findings as a sticky PR comment using the `submit_review` tool.

## Workflow

1. **Gather context**: Use GitHub CLI to get PR metadata
   ```bash
   gh pr view <number> --json files,title,body,headRefOid
   ```

2. **Create todo list**: One item per changed file using `todowrite`

3. **Analyze each file**:
   - Mark todo as `in_progress`
   - Read the file diff and surrounding context
   - Note issues (correctness, security, stability, maintainability)
   - Mark todo as `completed`

4. **Synthesize review**: After ALL files are analyzed, determine verdict and summary

5. **Submit**: Call `submit_review` exactly once with all findings

## Review Priorities

Focus on these areas in order of importance:

1. **Correctness** - Logic errors, broken control flow, off-by-one errors, incorrect conditions
2. **Security** - Injection vulnerabilities, auth issues, secrets in code, unsafe deserialization
3. **Stability** - Error handling, race conditions, resource leaks, null/undefined cases
4. **Maintainability** - Clarity, naming, violations of local conventions

Only flag style issues when they hide bugs or cause real confusion.

## Using submit_review

Call exactly once with these arguments:

| Argument | Type | Description |
|----------|------|-------------|
| `repository` | string | owner/repo format (from git remote) |
| `pullNumber` | number | PR number from task message |
| `commitSha` | string | headRefOid from PR metadata |
| `summary` | string | 1-3 sentence overall assessment |
| `verdict` | string | `approve` or `request_changes` |
| `issues` | array | List of findings |

Each issue in the array needs:

| Field | Type | Description |
|-------|------|-------------|
| `file` | string | File path from the diff |
| `line` | number | Line number on the NEW (right) side |
| `severity` | string | `critical`, `high`, `medium`, or `low` |
| `title` | string | Short description (~80 chars) |
| `explanation` | string | Why this matters, what's wrong |
| `suggestion` | string? | Optional: replacement code only, no prose |

## Verdict Rules

- Use `request_changes` if there are ANY medium, high, or critical issues
- Use `approve` if there are only low-severity issues or no issues at all
- The verdict must be consistent with the worst severity in the issues array

## Common Mistakes to Avoid

- Do NOT call `submit_review` more than once
- Do NOT use line numbers from the left (old) side of the diff
- Do NOT skip the per-file todo workflow
- Do NOT guess repository, PR number, or commit SHA - derive from git/gh commands
- Do NOT include JSON fragments in summary or explanation fields
- Do NOT put prose like "change to:" in the suggestion field

## Example Issue

```json
{
  "file": "src/auth/login.ts",
  "line": 42,
  "severity": "high",
  "title": "SQL injection vulnerability in user lookup",
  "explanation": "User input is concatenated directly into the SQL query without sanitization. An attacker could inject malicious SQL to bypass authentication or extract data.",
  "suggestion": "const user = await db.query('SELECT * FROM users WHERE email = $1', [email])"
}
```
