# Sidebar Refactor Plan

**Branch:** `feat/sidebar-refactor`  
**Created:** 2026-01-01  
**Status:** In Progress

## Overview

Refactoring the sidebar from a project-list-centric design to a project-context-aware navigation pattern with:
- Project dropdown selector (instead of expandable project list)
- Section-based navigation (PROJECT, TOOLS)
- Keyboard shortcuts for power users
- Create Ticket button moved from Board header to sidebar bottom

## Target Structure

```
[Header: KanbanAI | toggle button]
[ProjectSelector dropdown]
[Project path display]
---separator---
[SECTION: PROJECT]
  [Dashboard] - D -> /projects/:projectId/dashboard
  [Kanban Board] - K -> /projects/:projectId
  [Agents] - A -> /projects/:projectId/agents (placeholder)
---separator---
[SECTION: TOOLS]
  [GitHub Issues] - G -> /projects/:projectId/github-issues (placeholder)
  [Worktrees] - W -> /projects/:projectId/worktrees (placeholder)
---separator---
[AgentsSection] (existing expandable list - kept for now)
---spacer---
[+ Create Ticket button]
[GitHubAccountBox]
[Settings] [Help (placeholder)]
```

## Implementation Phases

### Phase 1: Foundation Components (~1.5 hours)

| Task | File | Status |
|------|------|--------|
| Create SectionLabel | `sidebar/SectionLabel.tsx` | Pending |
| Extend NavButton with shortcut | `sidebar/NavButton.tsx` | Pending |
| Create ProjectSelector | `sidebar/ProjectSelector.tsx` | Pending |
| Create useKeyboardShortcuts | `hooks/useKeyboardShortcuts.ts` | Pending |

### Phase 2: Placeholder Pages (~30 min)

| Page | Route | Shortcut | Status |
|------|-------|----------|--------|
| ProjectDashboardPage | `/projects/:projectId/dashboard` | D | Pending |
| AgentsPage | `/projects/:projectId/agents` | A | Pending |
| GitHubIssuesPage | `/projects/:projectId/github-issues` | G | Pending |
| WorktreesPage | `/projects/:projectId/worktrees` | W | Pending |

### Phase 3: Main Sidebar Restructure (~2-3 hours)

**File:** `client/src/components/layout/AppSidebar.tsx`

Changes:
- [x] Replace ProjectsList with ProjectSelector
- [x] Add project path display below selector
- [x] Remove top-level Dashboard/Projects NavButtons
- [x] Add PROJECT section with: Dashboard, Kanban Board, Agents
- [x] Add TOOLS section with: GitHub Issues, Worktrees
- [x] Keep AgentsSection below TOOLS
- [x] Add Create Ticket button at bottom (via onCreateTicket prop)
- [x] Add Help placeholder button next to Settings
- [x] Update collapsed state

### Phase 4: Board Header Update (~30 min)

**Files:**
- `client/src/components/kanban/Board.tsx` - Remove Create Ticket from header
- `client/src/pages/ProjectBoardPage.tsx` - Pass onCreateTicket callback
- `client/src/components/layout/AppLayout.tsx` - Wire up callback mechanism

### Phase 5: Routes Update (~30 min)

**File:** `client/src/App.tsx`

New routes:
```tsx
<Route path="projects/:projectId/dashboard" element={<ProjectDashboardPage />} />
<Route path="projects/:projectId/agents" element={<AgentsPage />} />
<Route path="projects/:projectId/github-issues" element={<GitHubIssuesPage />} />
<Route path="projects/:projectId/worktrees" element={<WorktreesPage />} />
```

### Phase 6: Test Updates (~1-2 hours)

**File:** `client/test/AppSidebar.test.tsx`

- Update selectors for new structure
- Add tests for ProjectSelector
- Add tests for section navigation
- Add tests for keyboard shortcuts
- Update collapsed state tests

## Keyboard Shortcuts

| Key | Action | Route |
|-----|--------|-------|
| D | Go to Project Dashboard | `/projects/:projectId/dashboard` |
| K | Go to Kanban Board | `/projects/:projectId` |
| A | Go to Agents | `/projects/:projectId/agents` |
| G | Go to GitHub Issues | `/projects/:projectId/github-issues` |
| W | Go to Worktrees | `/projects/:projectId/worktrees` |

*Shortcuts only active when a project is selected and no input is focused.*

## Files Changed

| Action | File |
|--------|------|
| Create | `client/src/components/layout/sidebar/ProjectSelector.tsx` |
| Create | `client/src/components/layout/sidebar/SectionLabel.tsx` |
| Create | `client/src/hooks/useKeyboardShortcuts.ts` |
| Create | `client/src/pages/ProjectDashboardPage.tsx` |
| Create | `client/src/pages/AgentsPage.tsx` |
| Create | `client/src/pages/GitHubIssuesPage.tsx` |
| Create | `client/src/pages/WorktreesPage.tsx` |
| Modify | `client/src/components/layout/sidebar/NavButton.tsx` |
| Modify | `client/src/components/layout/AppSidebar.tsx` |
| Modify | `client/src/components/layout/AppLayout.tsx` |
| Modify | `client/src/components/kanban/Board.tsx` |
| Modify | `client/src/pages/ProjectBoardPage.tsx` |
| Modify | `client/src/App.tsx` |
| Modify | `client/test/AppSidebar.test.tsx` |

## Notes

- Keep existing AgentsSection for now; will design proper Agents page later
- Global dashboard at `/dashboard` remains; project dashboard is separate
- Create Ticket state passed via props for now; will migrate to store later
- Help button is placeholder for now
