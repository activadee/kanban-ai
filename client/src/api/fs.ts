import type { FileBrowserResponse } from 'shared'
import { SERVER_URL } from '@/lib/env'
import { parseApiResponse } from '@/api/http'

export async function browseDirectory(
  path?: string,
  options?: { showHidden?: boolean; executablesOnly?: boolean }
): Promise<FileBrowserResponse> {
  const params = new URLSearchParams()
  if (path) params.set('path', path)
  if (options?.showHidden) params.set('showHidden', 'true')
  if (options?.executablesOnly) params.set('executablesOnly', 'true')
  
  const res = await fetch(`${SERVER_URL}/fs/browse?${params}`)
  return parseApiResponse<FileBrowserResponse>(res)
}
