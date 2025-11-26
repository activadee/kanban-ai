import {afterEach, describe, expect, it, vi} from 'vitest'
import {printHelp} from './help'

const originalLog = console.log

afterEach(() => {
    console.log = originalLog
})

describe('printHelp', () => {
    it('prints a help message with key sections', () => {
        const spy = vi.fn()
        console.log = spy

        printHelp()

        expect(spy).toHaveBeenCalledTimes(1)
        const output = String(spy.mock.calls[0][0])
        expect(output).toContain('KanbanAI CLI wrapper')
        expect(output).toContain('--binary-version')
        expect(output).toContain('KANBANAI_BINARY_VERSION')
    })
})
