# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react)
  uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc)
  uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also
install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x)
and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom)
for React-specific rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other options...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

## Project Settings layout

Project settings have been moved from dialog/drawer variants to a dedicated page at `/projects/:projectId/settings`.

- The `ProjectSettingsPage` component provides a full-page settings experience with 5 sections:
  - **General** - Project name, repository URL, and ticket numbering
  - **Agents** - Default agent selection
  - **Scripts** - Pre/post ticket enhancement scripts
  - **GitHub** - Issue sync and auto-close settings
  - **Inline Agents** - Configure inline agent behavior
- The page uses `MasterDetailLayout` for consistent sidebar navigation
- Settings sections use a consistent card-based layout with polished typography
- Each section component (`TicketNumberingForm`, `RepositoryDefaultsForm`, `AgentDefaultsForm`, `ScriptsForm`, `GithubIssueSyncSection`, `InlineAgentForm`) follows the same design pattern

## MasterDetailLayout

The `MasterDetailLayout<T>` component provides a consistent sidebar navigation pattern used across the application with generic type support for strongly-typed items:

```tsx
import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'

interface MyItem extends MasterDetailItem {
  cardId: string
  worktreePath: string
}

<MasterDetailLayout<MyItem>
  title="Workstations"
  items={items}
  activeId={activeId}
  onSelect={handleSelect}
  renderItem={renderItem}
  sidebarFooter={sidebarFooter}>
  {content}
</MasterDetailLayout<MyItem>>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Page title displayed in header |
| `items` | `T[]` | Array of items to display in sidebar |
| `activeId` | `string \| null` | ID of currently active/selected item |
| `onSelect` | `(id: string) => void` | Callback when item is selected |
| `renderItem` | `(item: T, isActive: boolean, defaultRender: () => ReactNode) => ReactNode` | Custom renderer for sidebar items (receives defaultRender callback for fallback) |
| `sidebarFooter` | `ReactNode \| null` | Content to render at bottom of sidebar (e.g., Quick Launch) |
| `sidebarClassName` | `string` | Additional CSS classes for sidebar |
| `loading` | `boolean` | Show loading state in sidebar |
| `emptyState` | `ReactNode` | Content when sidebar is empty |

### MasterDetailItem Interface

Base interface for sidebar items:

```typescript
interface MasterDetailItem {
  id: string
  label: string
  subtitle?: string
  icon?: React.ComponentType<{className?: string}>
  disabled?: boolean
}
```

This layout is used by:
- `ProjectSettingsPage` - Project settings with section navigation
- `AgentsPage` - Agent selection and management
- `TerminalsToolWindow` - Terminal sessions with worktree list

## New Pages

The sidebar refactor introduced several new dedicated pages:

- `/projects/:projectId/dashboard` - Project-specific dashboard with metrics
- `/projects/:projectId/agents` - Project-specific agent management
- `/projects/:projectId/github-issues` - GitHub issue viewing and syncing
- `/projects/:projectId/worktrees` - Git worktree management
- `/projects/:projectId/settings` - Full-page project settings (replaced dialog/drawer)
- `/projects/:projectId/terminals` - PTY terminal sessions in worktree directories

---
title: Client overview
---
