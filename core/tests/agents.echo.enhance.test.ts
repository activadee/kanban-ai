import {describe, expect, it} from 'vitest'

import type {TicketEnhanceInput} from '../src/agents/types'
import {EchoAgent} from '../src/agents/echo'

describe('EchoAgent.enhance', () => {
    it('keeps title and prefixes description deterministically', async () => {
        const controller = new AbortController()
        const input: TicketEnhanceInput = {
            projectId: 'proj-1',
            boardId: 'board-1',
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            title: 'Original Title',
            description: 'Original Description',
            profileId: null,
            signal: controller.signal,
        }

        const result = await EchoAgent.enhance(input, {})

        expect(result).toEqual({
            title: 'Original Title',
            description: '[ENHANCED] Original Description',
        })
    })
})

