export interface EditorOpenRequestedEvent {
    path: string
    editorKey?: string
    attemptId?: string
    projectId?: string
}

export interface EditorOpenSucceededEvent {
    path: string
    editorKey: string
    pid?: number
}

export interface EditorOpenFailedEvent {
    path: string
    editorKey?: string
    error: string
}

export type EditorEventMap = {
    'editor.open.requested': EditorOpenRequestedEvent
    'editor.open.succeeded': EditorOpenSucceededEvent
    'editor.open.failed': EditorOpenFailedEvent
}
