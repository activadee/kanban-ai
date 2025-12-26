export type EditorSuggestion = {
  key: string
  label: string
  bin: string
}

export type EditorValidationResult = {
  valid: boolean
  error?: string
}
