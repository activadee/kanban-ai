import { useQuery } from '@tanstack/react-query'
import { browseDirectory } from '@/api/fs'

export function useDirectoryBrowser(
  path?: string,
  options?: { showHidden?: boolean; executablesOnly?: boolean; enabled?: boolean }
) {
  return useQuery({
    queryKey: ['fs', 'browse', path, options?.showHidden, options?.executablesOnly],
    queryFn: () => browseDirectory(path, options),
    enabled: options?.enabled !== false,
  })
}
