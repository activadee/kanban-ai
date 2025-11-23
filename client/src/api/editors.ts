import {SERVER_URL} from '@/lib/env'
import {parseApiResponse} from '@/api/http'

export type EditorInfo = { key: string; label: string; installed: boolean; bin?: string }

export async function getEditors(): Promise<EditorInfo[]> {
    const res = await fetch(`${SERVER_URL}/editors`)
    const data = await parseApiResponse<{ editors: EditorInfo[] }>(res)
    return data.editors ?? []
}
