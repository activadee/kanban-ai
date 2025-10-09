import {SERVER_URL} from '@/lib/env'

export type EditorInfo = { key: string; label: string; installed: boolean; bin?: string }

export async function getEditors(): Promise<EditorInfo[]> {
    const res = await fetch(`${SERVER_URL}/editors`)
    if (!res.ok) throw new Error('Failed to list editors')
    const data = (await res.json()) as { editors: EditorInfo[] }
    return data.editors ?? []
}

