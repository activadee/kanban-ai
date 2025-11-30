import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, render, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider, useQueryClient} from '@tanstack/react-query'

import {
    prInlineSummaryKeys,
    usePrInlineSummaryCache,
    useSummarizePullRequest,
    type PrInlineSummaryCache,
} from '@/hooks/git'
import * as gitApi from '@/api/git'

describe('PR inline summary cache', () => {
    beforeEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    const renderWithClient = (client: QueryClient, node: React.ReactNode) =>
        render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)

    it('keeps a running inline summary alive after unmount and caches the result', async () => {
        let resolveSummary: ((v: { title: string; body: string }) => void) | undefined
        vi.spyOn(gitApi, 'summarizeProjectPullRequest').mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveSummary = resolve
                }),
        )

        const client = new QueryClient()
        const cachedKey: { key?: readonly unknown[] } = {}

        function Trigger({start}: { start: boolean }) {
            const queryClient = useQueryClient()
            const summary = usePrInlineSummaryCache('proj-1', 'feature/bg', 'main')
            const mutation = useSummarizePullRequest()

            React.useEffect(() => {
                if (!start || !summary.key) return
                const key = summary.key
                queryClient.setQueryData<PrInlineSummaryCache>(key, {
                    status: 'running',
                    branch: 'feature/bg',
                    base: 'main',
                    original: {title: 'Orig', body: ''},
                })
                mutation.mutate(
                    {projectId: 'proj-1', branch: 'feature/bg', base: 'main'},
                    {
                        onSuccess: (result) => {
                            queryClient.setQueryData<PrInlineSummaryCache>(key, {
                                status: 'success',
                                summary: result,
                                branch: 'feature/bg',
                                base: 'main',
                                original: {title: 'Orig', body: ''},
                            })
                        },
                    },
                )
                cachedKey.key = key
            }, [mutation, queryClient, start, summary.key])

            return null
        }

        const view = renderWithClient(client, <Trigger start />)
        await waitFor(() => expect(cachedKey.key).toBeDefined())

        view.rerender(
            <QueryClientProvider client={client}>
                <Trigger start={false} />
            </QueryClientProvider>,
        )
        resolveSummary?.({title: 'Ready title', body: 'Ready body'})

        await waitFor(() => {
            const cached = client.getQueryData<PrInlineSummaryCache>(cachedKey.key!)
            expect(cached?.status).toBe('success')
            expect(cached?.summary?.title).toBe('Ready title')
        })
    })

    it('rehydrates cached summaries when the dialog is reopened', async () => {
        const client = new QueryClient()
        const key = prInlineSummaryKeys.detail('proj-2', 'feature/rehydrate', 'main')
        client.setQueryData<PrInlineSummaryCache>(key, {
            status: 'success',
            summary: {title: 'Cached title', body: 'Cached body'},
            branch: 'feature/rehydrate',
            base: 'main',
            original: {title: 'Orig', body: ''},
            completedAt: Date.now(),
        })

        const onData = vi.fn()

        function Reader() {
            const summary = usePrInlineSummaryCache('proj-2', 'feature/rehydrate', 'main')
            React.useEffect(() => {
                onData(summary.data)
            }, [summary.data])
            return null
        }

        renderWithClient(client, <Reader />)

        await waitFor(() => expect(onData).toHaveBeenCalled())
        const latest = onData.mock.calls.at(-1)?.[0] as PrInlineSummaryCache
        expect(latest.status).toBe('success')
        expect(latest.summary?.title).toBe('Cached title')
    })

    it('keeps cache entries scoped by project and branch', async () => {
        const client = new QueryClient()
        const scopedKey = prInlineSummaryKeys.detail('proj-3', 'feature/existing', 'main')
        client.setQueryData<PrInlineSummaryCache>(scopedKey, {
            status: 'success',
            summary: {title: 'Existing title', body: 'Existing body'},
            branch: 'feature/existing',
            base: 'main',
        })

        const seen: PrInlineSummaryCache[] = []

        function Reader() {
            const summary = usePrInlineSummaryCache('proj-3', 'feature/new', 'main')
            React.useEffect(() => {
                if (summary.data) seen.push(summary.data)
            }, [summary.data])
            return null
        }

        renderWithClient(client, <Reader />)

        await waitFor(() => expect(seen.length).toBeGreaterThan(0))
        expect(seen.at(-1)?.status).toBe('idle')
        expect(client.getQueryData<PrInlineSummaryCache>(scopedKey)?.summary?.title).toBe('Existing title')
    })
})
