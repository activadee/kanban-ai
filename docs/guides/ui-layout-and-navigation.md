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

The left sidebar provides quick access to the main areas of KanbanAI:

- **Dashboard** - Mission Control with KPIs, live agent activity, inbox, and project health
- **Projects** - Your kanban boards organized by project
- **Project list** - Scrollable list of all projects with quick access to settings
- **Agents** - View registered agents and their status
- **GitHub account** - Connection status and quick access to manage GitHub integration
- **Settings** - Global app settings and preferences

### Collapsible sidebar

The sidebar can be collapsed to maximize your workspace area:

- **Toggle button** - Click the collapse/expand icon in the sidebar header
- **Collapsed mode** - Shows icon-only navigation for quick access to main areas
- **Expanded mode** - Shows full labels and additional context (project names, GitHub account details, etc.)
- **Persistent state** - Your collapsed preference is saved in browser localStorage and remembered across sessions

#### Expanded sidebar (default)

In the expanded state (width: 256px), the sidebar displays:

- Full navigation labels (Dashboard, Projects)
- Complete project list with names
- GitHub account box with username and avatar
- Full Settings label
- Additional controls (Refresh, Create project)

#### Collapsed sidebar

In the collapsed state (width: 64px), the sidebar displays:

- Icon-only navigation buttons with tooltips
- Simplified GitHub connection button
- All navigation remains accessible via tooltips on hover

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

## Card inspector (right panel)

When you select a card on a project board, the card inspector opens on the right side of the screen:

- **Desktop**: Opens as a side panel that shares space with the board. A vertical handle lets you resize the panel width (approximately 22%–65% of viewport)
- **Mobile**: Opens as a full-height sheet that slides in from the right

The inspector width is persisted in browser storage, so your preferred size is restored when you return to the board.

See the [Attempts & inspector guide](attempts-and-inspector-ui) for detailed information about using the inspector.

## Keyboard navigation

The UI supports keyboard navigation for accessibility and efficiency:

- Use `Tab` to navigate between interactive elements
- Use `Enter` or `Space` to activate buttons and links
- Press `Escape` to close dialogs and the inspector
- Use arrow keys for navigation within dropdowns and lists
