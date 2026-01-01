import {useEffect, useCallback} from 'react'
import {useNavigate, useParams} from 'react-router-dom'

type ShortcutMap = Record<string, string>

const PROJECT_SHORTCUTS: ShortcutMap = {
    d: 'dashboard',
    k: '', // Kanban board is the root project route
    a: 'agents',
    g: 'github-issues',
    w: 'worktrees',
}

/**
 * Hook for global keyboard shortcuts in the sidebar navigation.
 * Shortcuts are only active when:
 * - A project is selected (projectId in URL params)
 * - No input/textarea/contenteditable is focused
 */
export function useKeyboardShortcuts() {
    const navigate = useNavigate()
    const {projectId} = useParams<{projectId: string}>()

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Skip if no project is selected
            if (!projectId) return

            // Skip if modifier keys are pressed (allow Cmd+K, Ctrl+K, etc.)
            if (event.metaKey || event.ctrlKey || event.altKey) return

            // Skip if user is typing in an input
            const target = event.target as HTMLElement
            const tagName = target.tagName.toLowerCase()
            if (
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select' ||
                target.isContentEditable
            ) {
                return
            }

            const key = event.key.toLowerCase()
            const route = PROJECT_SHORTCUTS[key]

            if (route !== undefined) {
                event.preventDefault()
                const path = route
                    ? `/projects/${projectId}/${route}`
                    : `/projects/${projectId}`
                navigate(path)
            }
        },
        [navigate, projectId]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
