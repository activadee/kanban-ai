#!/usr/bin/env bash
set -euo pipefail

YAML_FILE="${1:-issues.yaml}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI 'gh' is not installed or not in PATH." >&2
  exit 1
fi

if ! command -v yq >/dev/null 2>&1; then
  echo "Error: 'yq' is required to parse YAML (https://github.com/mikefarah/yq)." >&2
  exit 1
fi

if [ ! -f "$YAML_FILE" ]; then
  echo "Error: YAML file '$YAML_FILE' not found." >&2
  exit 1
fi

REPO_NAME=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "current repo")
echo "Creating epic and issues from '$YAML_FILE' in repository: $REPO_NAME"
echo

# --- Create epic issue -------------------------------------------------------

epic_title=$(yq -r '.epic.title' "$YAML_FILE")
epic_body=$(yq -r '.epic.body' "$YAML_FILE" 2>/dev/null || echo "")

echo "Creating epic: $epic_title"

epic_output=$(gh issue create \
  --title "$epic_title" \
  --body "$epic_body")

echo "$epic_output"

epic_url=$(echo "$epic_output" | tail -n1)
epic_number=$(echo "$epic_url" | sed -E 's#.*/issues/([0-9]+).*#\1#')

if ! [[ "$epic_number" =~ ^[0-9]+$ ]]; then
  echo "Error: Could not parse epic issue number from output: $epic_url" >&2
  exit 1
fi

echo "Epic created: #$epic_number"
echo

# --- Create child issues -----------------------------------------------------

issues_count=$(yq -r '.issues | length' "$YAML_FILE" 2>/dev/null || echo "0")

if [ "$issues_count" -eq 0 ]; then
  echo "No issues found under .issues in YAML file."
  exit 0
fi

for (( i=0; i<issues_count; i++ )); do
  title=$(yq -r ".issues[$i].title" "$YAML_FILE")
  key=$(yq -r ".issues[$i].key" "$YAML_FILE")
  body=$(yq -r ".issues[$i].body" "$YAML_FILE" 2>/dev/null || echo "")

  full_body="$body

---

Epic: #$epic_number
Key: $key
"

  echo "Creating issue: $title"
  gh issue create \
    --title "$title" \
    --body "$full_body"

  echo
done

echo "Done. Epic #$epic_number and all child issues have been created."
