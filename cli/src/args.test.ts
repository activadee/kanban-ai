import {describe, expect, it} from 'vitest'
import {parseCliArgs} from './args'

describe('parseCliArgs', () => {
    it('parses binary version with separate value', () => {
        const opts = parseCliArgs(['--binary-version', '1.2.3'], undefined, false)
        expect(opts.binaryVersion).toBe('1.2.3')
        expect(opts.passThroughArgs).toEqual([])
    })

    it('parses binary version with equals syntax', () => {
        const opts = parseCliArgs(['--binary-version=2.3.4'], undefined, false)
        expect(opts.binaryVersion).toBe('2.3.4')
    })

    it('respects env version override when no flag is provided', () => {
        const opts = parseCliArgs([], '3.4.5', false)
        expect(opts.binaryVersion).toBe('3.4.5')
    })

    it('parses no-update-check flag', () => {
        const opts = parseCliArgs(['--no-update-check'], undefined, false)
        expect(opts.noUpdateCheck).toBe(true)
    })

    it('parses help and version flags', () => {
        const opts = parseCliArgs(['--help', '--cli-version', '--version'], undefined, false)
        expect(opts.showHelp).toBe(true)
        expect(opts.showCliVersion).toBe(true)
        expect(opts.showBinaryVersionOnly).toBe(true)
    })

    it('splits wrapper args from pass-through args using -- separator', () => {
        const opts = parseCliArgs(['--binary-version', '1.2.3', '--', '--foo', 'bar'], undefined, false)
        expect(opts.binaryVersion).toBe('1.2.3')
        expect(opts.passThroughArgs).toEqual(['--foo', 'bar'])
    })

    it('treats unknown flags as pass-through args', () => {
        const opts = parseCliArgs(['--unknown', 'value'], undefined, false)
        expect(opts.passThroughArgs).toEqual(['--unknown', 'value'])
    })
})
