import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {render, cleanup, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'

import {useSummarizePullRequest} from '@/hooks/git'
import * as gitApi from '@/api/git'

function TestComponent(props: {onReady: (mutation: ReturnType<typeof useSummarizePullRequest>) => void}) {
    const mutation = useSummarizePullRequest()

    React.useEffect(() => {
        props.onReady(mutation)
    }, [mutation, props])

    return null
}

describe('useSummarizePullRequest', () => {
    beforeEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('calls summarizeProjectPullRequest with expected payload and returns summary', async () => {
        const summarizeSpy = vi
            .spyOn(gitApi, 'summarizeProjectPullRequest')
            .mockResolvedValue({title: 'PR Title', body: 'PR Body'})

        const queryClient = new QueryClient()
        let mutation: ReturnType<typeof useSummarizePullRequest> | undefined

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(m) => (mutation = m)} />
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(mutation).toBeDefined()
        })

        const result = await mutation!.mutateAsync({
            projectId: 'proj-1',
            base: 'main',
            branch: 'feature/test',
        })

        expect(summarizeSpy).toHaveBeenCalledWith('proj-1', {
            base: 'main',
            branch: 'feature/test',
            agent: undefined,
            profileId: undefined,
        }, undefined)

        expect(result).toEqual({
            title: 'PR Title',
            body: 'PR Body',
        })
    })
})
