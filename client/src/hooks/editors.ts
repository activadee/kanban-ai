import { useQuery, useMutation } from '@tanstack/react-query'
import { getEditorSuggestions, validateEditorPath } from '@/api/editors'

export function useEditorSuggestions() {
  return useQuery({
    queryKey: ['editors', 'suggestions'],
    queryFn: getEditorSuggestions,
  })
}

export function useValidateEditorPath() {
  return useMutation({
    mutationFn: validateEditorPath,
  })
}
