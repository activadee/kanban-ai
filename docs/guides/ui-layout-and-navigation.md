---
title: UI layout & navigation
---

# UI layout & navigation

This guide explains the main application layout, including the sidebar navigation and how to customize your workspace.

## Application layout

KanbanAI uses a responsive layout with three main sections:

- **Left sidebar** - Primary navigation for accessing projects, dashboard, and settings
- **Main content area** - The kanban board, dashboard panels, or settings pages
- **Right panel (desktop)** - The card inspector, which slides in when you select a card

The layout adapts to different screen sizes, with the inspector sliding in as a full-height sheet on mobile devices and as a side panel on desktop.

## Sidebar navigation

The left sidebar provides quick access to projects and tools. The sidebar has been redesigned with a project-context-aware pattern:

### Sidebar sections

The sidebar is organized into two main sections:

- **PROJECT section** - Core project navigation:
  - **Dashboard** - Project-specific metrics and KPIs
  - **Kanban Board** - Your task board for this project
  - **Agents** - Manage agents for this project
- **TOOLS section** - Utility tools:
  - **GitHub Issues** - View and sync GitHub issues
  - **Worktrees** - Manage git worktrees

### Project selector

At the top of the sidebar, a project dropdown selector allows you to:

- Quickly switch between your projects
- See the current project path and repository
- Access project settings directly from the selector

### Keyboard shortcuts

Power users can navigate quickly using keyboard shortcuts (when no input is focused):

| Key | Action | Route |
|-----|--------|-------|
| `D` | Go to Project Dashboard | `/projects/:projectId/dashboard` |
| `K` | Go to Kanban Board | `/projects/:projectId` |
| `A` | Go to Agents | `/projects/:projectId/agents` |
| `G` | Go to GitHub Issues | `/projects/:projectId/github-issues` |
| `W` | Go to Worktrees | `/projects/:projectId/worktrees` |

### Collapsible sidebar

The sidebar can be collapsed to maximize your workspace area:

- **Toggle button** - Click the collapse/expand icon in the sidebar header
- **Collapsed mode** - Shows icon-only navigation for quick access to main areas
- **Expanded mode** - Shows full labels and additional context (section labels, project name)
- **Persistent state** - Your collapsed preference is saved in browser localStorage and remembered across sessions

#### Expanded sidebar (default)

In the expanded state (width: 256px), the sidebar displays:

- Project selector dropdown with current project name and path
- Navigation sections (PROJECT, TOOLS) with section labels
- Full navigation labels with keyboard shortcuts
- Create Ticket button at the bottom
- GitHub account box with username and avatar
- Settings button
- Version indicator showing the current application version

#### Collapsed sidebar

In the collapsed state (width: 64px), the sidebar displays:

- Icon-only navigation buttons with tooltips showing labels and shortcuts
- Simplified GitHub connection button
- All navigation remains accessible via tooltips on hover
- Version indicator at the bottom (full version shown when expanded; shows amber pulsing dot when update available in collapsed mode)

The collapse toggle button is always visible in the header, changing icon to indicate current state (panel-left-close when expanded, panel-right when collapsed).

### Smooth transitions

The sidebar uses smooth CSS transitions (300ms) when collapsing or expanding, providing a polished experience without jarring jumps.

### Accessibility

The sidebar includes proper ARIA attributes for accessibility:

- `aria-expanded` indicates whether the sidebar is currently collapsed
- `aria-label` on the toggle button describes the action (Expand sidebar / Collapse sidebar)
- All icon-only buttons in collapsed mode include `title` attributes for screen readers and keyboard users

### GitHub account box

The GitHub account box appears at the bottom of the sidebar and adapts to the collapsed state:

- **Expanded**: Shows avatar or GitHub icon, username, connection status, and Connect/Disconnect button
- **Collapsed**: Shows simplified icon-only button with avatar or GitHub icon, with hover tooltip showing connection details

Clicking the GitHub account box opens a dialog where you can view account details or disconnect your GitHub integration.

### Create Ticket button

The Create Ticket button is located at the bottom of the sidebar, making it easily accessible from any page within a project. Clicking it opens a dialog to create a new ticket in the current project.

### Global vs Project navigation

KanbanAI maintains two levels of navigation:

- **Global navigation** - The main sidebar always shows project-aware navigation when a project is selected
- **Project dashboard** - A dedicated `/projects/:projectId/dashboard` route provides project-specific metrics
- **Global dashboard** - The `/dashboard` route provides mission control with KPIs across all projects

## Card inspector (right panel)

When you select a card on a project board, the card inspector opens on the right side of the screen:

- **Desktop**: Opens as a side panel that shares space with the board. A vertical handle lets you resize the panel width (approximately 22%-65% of viewport)
- **Mobile**: Opens as a full-height sheet that slides in from the right

The inspector width is persisted in browser storage, so your preferred size is restored when you return to the board.

See the [Attempts & inspector guide](attempts-and-inspector-ui) for detailed information about using the inspector.

## Keyboard navigation

The UI supports keyboard navigation for accessibility and efficiency:

- Use `Tab` to navigate between interactive elements
- Use `Enter` or `Space` to activate buttons and links
- Press `Escape` to close dialogs and the inspector
- Use arrow keys for navigation within dropdowns and lists
