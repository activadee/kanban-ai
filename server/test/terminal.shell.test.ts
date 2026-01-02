import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {getDefaultShell} from '../src/terminal/shell'

describe('getDefaultShell', () => {
    const originalEnv = {...process.env}

    beforeEach(() => {
        process.env = {...originalEnv}
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('on current platform', () => {
        const isWindows = process.platform === 'win32'

        if (isWindows) {
            it('returns cmd.exe by default on Windows when COMSPEC not set', () => {
                delete process.env.COMSPEC
                expect(getDefaultShell()).toBe('cmd.exe')
            })

            it('returns COMSPEC when it contains powershell', () => {
                process.env.COMSPEC = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
                expect(getDefaultShell()).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
            })

            it('returns COMSPEC (cmd.exe) when COMSPEC does not contain powershell', () => {
                process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe'
                expect(getDefaultShell()).toBe('C:\\Windows\\System32\\cmd.exe')
            })
        } else {
            it('returns SHELL env when set', () => {
                process.env.SHELL = '/bin/zsh'
                expect(getDefaultShell()).toBe('/bin/zsh')
            })

            it('returns /bin/sh when SHELL is not set', () => {
                delete process.env.SHELL
                expect(getDefaultShell()).toBe('/bin/sh')
            })

            it('respects custom SHELL values', () => {
                process.env.SHELL = '/usr/local/bin/fish'
                expect(getDefaultShell()).toBe('/usr/local/bin/fish')
            })
        }
    })

    describe('function behavior', () => {
        it('returns a string', () => {
            const shell = getDefaultShell()
            expect(typeof shell).toBe('string')
            expect(shell.length).toBeGreaterThan(0)
        })
    })
})
