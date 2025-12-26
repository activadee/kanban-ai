import type { EditorSuggestion, EditorValidationResult } from 'shared'
import { SERVER_URL } from '@/lib/env'
import { parseApiResponse } from '@/api/http'

export async function getEditorSuggestions(): Promise<EditorSuggestion[]> {
  const res = await fetch(`${SERVER_URL}/editors/suggestions`)
  const data = await parseApiResponse<{ suggestions: EditorSuggestion[] }>(res)
  return data.suggestions
}

export async function validateEditorPath(path: string): Promise<EditorValidationResult> {
  const res = await fetch(`${SERVER_URL}/editors/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  return parseApiResponse<EditorValidationResult>(res)
}
