import {useQuery, type UseQueryOptions} from '@tanstack/react-query'
import type {EditorInfo} from '@/api/editors'
import {getEditors} from '@/api/editors'

const EDITORS_KEY = ['editors'] as const

type Options = Partial<UseQueryOptions<EditorInfo[]>>

export function useEditors(options?: Options) {
    return useQuery({
        queryKey: EDITORS_KEY,
        queryFn: getEditors,
        ...options,
    })
}
