import {useQuery, type UseQueryOptions} from '@tanstack/react-query'
import type {AppVersionResponse} from 'shared'
import {getAppVersion} from '@/api/version'
import {appVersionKeys} from '@/lib/queryClient'

type Options = Partial<UseQueryOptions<AppVersionResponse>>

export function useAppVersion(options?: Options) {
    return useQuery({
        queryKey: appVersionKeys.info(),
        queryFn: getAppVersion,
        staleTime: 15 * 60_000,
        gcTime: 30 * 60_000,
        retry: false,
        ...options,
    })
}
