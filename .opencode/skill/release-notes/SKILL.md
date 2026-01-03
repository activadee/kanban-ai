---
name: release-notes
description: Analyze commits since last release, determine semantic version bump, publish to npm, and create GitHub release with notes.
license: MIT
metadata:
  trigger: workflow_dispatch
  tools: bun_release, github_release
---

## What I Do

Automate the release process: analyze commits, determine version, publish to npm, and create a GitHub release with generated notes.

## Workflow

Use `todowrite` to create and track these steps:

1. **Get current version** from `package.json`
2. **Find previous release tag** using git
3. **List commits since last tag**
4. **Fetch merged pull requests** in that range
5. **Determine version bump type** (major/minor/patch)
6. **Generate release notes**
7. **Call `bun_release`** to publish to npm
8. **Call `github_release`** to create GitHub release

## Gathering Context

```bash
# Get current version
cat package.json | jq -r '.version'

# Find previous tag
git describe --tags --abbrev=0

# List commits since tag
git log <prev-tag>..HEAD --oneline

# Get merged PRs
gh pr list --state merged --base main --json number,title,author
```

## Version Determination

Use semantic versioning based on commit analysis:

### MAJOR bump (x.0.0)
- Commits containing "BREAKING CHANGE" in body
- Commits starting with `feat!:` or `fix!:` (with `!`)
- API removals or incompatible interface changes

### MINOR bump (x.y.0)
- Commits starting with `feat:` or `feat(`
- New functionality that doesn't break existing behavior

### PATCH bump (x.y.z)
- Commits starting with `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`
- Any other commits not matching above patterns

### Rules
- If ANY commit requires MAJOR → bump major, reset minor and patch to 0
- Else if ANY commit requires MINOR → bump minor, reset patch to 0
- Else → bump patch only

## Release Notes Format

Include only user-facing changes. Each note should follow:

```
<description> [#<issue>] [#<pr>] @<author>
```

**Include:**
- New features
- Bug fixes
- Performance improvements
- Important config/doc updates

**Exclude:**
- Pure dependency bumps
- Version bump commits
- Formatting-only changes
- Reverts that undo previous changes
- Merge commits

### Example Notes
- Add retry logic to GitHub API calls #42 @alice
- Fix label creation for special characters #38 @bob
- Improve error messages for auth failures @carol

## Using bun_release (Call FIRST)

Publishes to npm. Call before `github_release`.

| Argument | Type | Description |
|----------|------|-------------|
| `version` | string | New version (e.g., "1.2.3" or "v1.2.3") |

What it does:
1. Runs `bun pm version` to update package.json
2. Pushes commit and tag to remote
3. Runs `bun publish --access public`

## Using github_release (Call SECOND)

Creates GitHub release. Call only after `bun_release` succeeds.

| Argument | Type | Description |
|----------|------|-------------|
| `repository` | string | owner/repo format |
| `tag` | string | Version with "v" prefix (e.g., "v1.2.3") |
| `notes` | string[] | Array of release notes (without "- " prefix) |
| `title` | string? | Optional: release title (defaults to tag) |
| `prerelease` | boolean? | Set true for -alpha, -beta, -rc versions |
| `draft` | boolean? | Set true to create as draft |

## Special Cases

### No Commits Since Last Tag
- Report to user that no release is needed
- Do NOT call either tool

### No Previous Tag (First Release)
- Analyze all commits in repository
- Use version from package.json or default to 0.1.0

### bun_release Fails
- Do NOT call github_release
- Report the error to user
- The publish must succeed before creating GitHub release

## Common Mistakes to Avoid

- Do NOT call `github_release` before `bun_release` succeeds
- Do NOT guess repository name - derive from git/gh commands
- Do NOT forget the "v" prefix on the tag for `github_release`
- Do NOT include version bump commits in release notes
- Do NOT include merge commits in release notes
- Do NOT forget author handles (@username) in release notes
- Do NOT skip the todo list workflow
- Do NOT create a release when there are no new commits
