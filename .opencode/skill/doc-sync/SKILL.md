---
name: doc-sync
description: Keep documentation in sync with code changes. Analyzes PR diffs and updates relevant docs using native write and bash tools.
license: MIT
metadata:
  trigger: pull_request
  tools: write, bash, read, glob
---

## What I Do

Analyze pull request changes and update documentation to reflect code changes. Uses native OpenCode tools (`write`, `bash`) instead of custom commit tools.

## Workflow

1. **Gather PR context**:
   ```bash
   gh pr view <number> --json files,title,body,headRefOid
   ```

2. **Create todo list**: One item per changed file using `todowrite`

3. **Analyze each file**:
   - Mark todo as `in_progress`
   - Identify user-visible changes (APIs, config, behavior)
   - Note which documentation might need updates
   - Mark todo as `completed`

4. **After ALL files analyzed**:
   - Identify affected documentation files
   - Read current content of each doc file
   - Plan minimal, precise updates

5. **Update documentation**: Use `write` tool for each file needing changes

6. **Commit and push**: Use `bash` tool for git operations

## Documentation Scope

Check these locations first:
- `README.md` at repository root
- Files under `docs/` directory
- API documentation if present
- Configuration examples
- Other markdown files at root

## What to Update

| Code Change | Documentation Update |
|-------------|---------------------|
| New feature | Add documentation |
| Changed behavior | Update existing docs |
| Removed feature | Remove or mark deprecated |
| New config option | Document option and defaults |
| Changed API | Update examples and usage |

## Committing Changes

After updating documentation files with `write`, commit using `bash`:

```bash
git add README.md docs/
git commit -m "[skip ci] docs: <description of changes>"
git push
```

**Important**: The `[skip ci]` prefix prevents infinite workflow loops.

## Style Guidelines

- Keep documentation concise and accurate
- Match existing tone and formatting
- Prefer targeted edits over large rewrites
- Ensure code examples are syntactically correct
- Don't invent features not present in the code

## No Changes Needed

If the existing documentation is already accurate:
- Do NOT create an empty commit
- Do NOT call any git commands
- Simply report that no documentation updates were required
- Explain briefly why the docs are already correct

## Common Mistakes to Avoid

- Do NOT update docs unrelated to the PR
- Do NOT start editing before completing all file analyses
- Do NOT generate marketing-style or overly verbose content
- Do NOT change code examples unless the underlying code changed
- Do NOT duplicate information across multiple files
- Do NOT commit with an empty file list

## Example Workflow

1. PR changes `src/config/options.ts` to add new `timeout` option
2. Analyze: user-visible config change
3. Check `README.md` and `docs/configuration.md`
4. Update `docs/configuration.md` with new option description
5. Commit: `[skip ci] docs: add timeout configuration option`
