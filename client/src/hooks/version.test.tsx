import React from 'react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {renderHook, waitFor, render, screen} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {useAppVersion} from './version'
import {VersionIndicator} from '@/components/system/VersionIndicator'

const createWrapper = () => {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
        },
    })
    const Wrapper = ({children}: {children: React.ReactNode}) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return {Wrapper, client}
}

const mockVersionResponse = (body: any) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(body), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        }),
    )

describe('useAppVersion', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns version info on success', async () => {
        mockVersionResponse({
            currentVersion: '0.9.1',
            latestVersion: '0.9.1',
            updateAvailable: false,
            checkedAt: new Date().toISOString(),
        })
        const {Wrapper} = createWrapper()

        const {result} = renderHook(() => useAppVersion(), {wrapper: Wrapper})

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.currentVersion).toBe('0.9.1')
        expect(result.current.data?.updateAvailable).toBe(false)
    })

    it('handles errors without throwing', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
        const {Wrapper} = createWrapper()

        const {result} = renderHook(() => useAppVersion(), {wrapper: Wrapper})

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})

describe('<VersionIndicator />', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows badge when update is available', async () => {
        mockVersionResponse({
            currentVersion: '0.9.1',
            latestVersion: '0.10.0',
            updateAvailable: true,
            checkedAt: new Date().toISOString(),
        })
        const {Wrapper} = createWrapper()

        render(<VersionIndicator/>, {wrapper: Wrapper})

        expect(await screen.findByText(/Update available/i)).toBeTruthy()
        expect(screen.getByText(/v0\.9\.1/)).toBeTruthy()
    })

    it('shows subtle label when up to date', async () => {
        mockVersionResponse({
            currentVersion: '0.9.1',
            latestVersion: '0.9.1',
            updateAvailable: false,
            checkedAt: new Date().toISOString(),
        })
        const {Wrapper} = createWrapper()

        render(<VersionIndicator/>, {wrapper: Wrapper})

        expect(await screen.findByText(/v0\.9\.1/)).toBeTruthy()
        expect(screen.queryByText(/Update available/i)).toBeNull()
    })

    it('falls back to unavailable label on error', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
        const {Wrapper} = createWrapper()

        render(<VersionIndicator/>, {wrapper: Wrapper})

        expect(await screen.findByText(/Version unavailable/i)).toBeTruthy()
    })
})
