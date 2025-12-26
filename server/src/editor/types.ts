export type ExecSpec = { cmd: string; args: string[]; line: string }
export type EditorKey = 'VS_CODE' | 'WEBSTORM' | 'ZED' | 'ANTIGRAVITY'
export type EditorInfo = { key: EditorKey; label: string; installed: boolean; bin?: string }

export type EditorAdapter = {
    key: EditorKey
    label: string
    detect(): EditorInfo
    buildSpec(path: string): ExecSpec | null
    buildFallback(path: string): string
}
