import {useMutation, useQuery, type UseMutationOptions, type UseQueryOptions} from '@tanstack/react-query'
import type {AppSettingsResponse, UpdateAppSettingsRequest} from 'shared'
import {getAppSettings, patchAppSettings} from '@/api/settings'

const APP_SETTINGS_KEY = ['app-settings'] as const

type AppSettings = AppSettingsResponse['settings']

type AppSettingsOptions = Partial<UseQueryOptions<AppSettings>>

export function useAppSettings(options?: AppSettingsOptions) {
    return useQuery({
        queryKey: APP_SETTINGS_KEY,
        queryFn: getAppSettings,
        ...options,
    })
}

type UpdateAppSettingsOptions = UseMutationOptions<AppSettings, Error, UpdateAppSettingsRequest>

export function useUpdateAppSettings(options?: UpdateAppSettingsOptions) {
    return useMutation({
        mutationFn: (update: UpdateAppSettingsRequest) => patchAppSettings(update),
        ...options,
    })
}
