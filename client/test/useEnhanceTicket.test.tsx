import React from 'react'
import {describe, it, expect, beforeEach, vi} from 'vitest'
import {render, waitFor, cleanup} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {useEnhanceTicket} from '@/hooks/projects'

vi.mock('@/lib/env', () => ({
    SERVER_URL: 'http://test-server/api/v1',
}))

function TestComponent(props: {onReady: (mutation: ReturnType<typeof useEnhanceTicket>) => void}) {
    const mutation = useEnhanceTicket()

    React.useEffect(() => {
        props.onReady(mutation)
    }, [mutation, props])

    return null
}

describe('useEnhanceTicket', () => {
    beforeEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('calls the enhance endpoint with correct payload and returns data', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    ticket: {
                        title: 'Enhanced Title',
                        description: 'Enhanced Description',
                    },
                }),
                {
                    status: 200,
                    headers: {'Content-Type': 'application/json'},
                },
            ),
        )

        // @ts-expect-error - assigning to global fetch in test environment
        global.fetch = fetchMock

        const queryClient = new QueryClient()
        let mutation: ReturnType<typeof useEnhanceTicket> | undefined

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
            title: 'Original Title',
            description: 'Original Description',
            agent: 'CODEX',
            profileId: 'profile-1',
            ticketType: 'feat',
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith(
            'http://test-server/api/v1/projects/proj-1/tickets/enhance',
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    title: 'Original Title',
                    description: 'Original Description',
                    agent: 'CODEX',
                    profileId: 'profile-1',
                    ticketType: 'feat',
                }),
            },
        )

        expect(result).toEqual({
            ticket: {
                title: 'Enhanced Title',
                description: 'Enhanced Description',
            },
        })
    })
})
