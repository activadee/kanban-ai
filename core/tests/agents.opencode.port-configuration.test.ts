import {describe, expect, it} from 'vitest'
import {isValidPort, getEffectivePort, DEFAULT_OPENCODE_PORT} from '../src/agents/opencode/core/agent'

describe('Port Configuration', () => {
    describe('isValidPort', () => {
        it('returns false for null or undefined', () => {
            expect(isValidPort(null)).toBe(false)
            expect(isValidPort(undefined)).toBe(false)
        })

        it('returns true for valid port numbers in range 1-65535', () => {
            expect(isValidPort(1)).toBe(true)
            expect(isValidPort(4097)).toBe(true)
            expect(isValidPort(5000)).toBe(true)
            expect(isValidPort(65535)).toBe(true)
        })

        it('returns false for invalid port numbers', () => {
            expect(isValidPort(0)).toBe(false)
            expect(isValidPort(-1)).toBe(false)
            expect(isValidPort(65536)).toBe(false)
            expect(isValidPort(100000)).toBe(false)
            expect(isValidPort(1.5)).toBe(false)
            expect(isValidPort(Infinity)).toBe(false)
            expect(isValidPort(NaN)).toBe(false)
        })

        it('rejects reserved ports', () => {
            expect(isValidPort(80)).toBe(false)
            expect(isValidPort(443)).toBe(false)
            expect(isValidPort(22)).toBe(false)
            expect(isValidPort(25)).toBe(false)
            expect(isValidPort(53)).toBe(false)
            expect(isValidPort(110)).toBe(false)
            expect(isValidPort(143)).toBe(false)
            expect(isValidPort(993)).toBe(false)
            expect(isValidPort(995)).toBe(false)
            expect(isValidPort(3306)).toBe(false)
            expect(isValidPort(5432)).toBe(false)
            expect(isValidPort(6379)).toBe(false)
            expect(isValidPort(8080)).toBe(false)
            expect(isValidPort(8443)).toBe(false)
        })
    })

    describe('getEffectivePort', () => {
        it('returns the configured port when valid', () => {
            expect(getEffectivePort(5000)).toBe(5000)
        })

        it('returns default port when port is null or undefined', () => {
            expect(getEffectivePort(null)).toBe(DEFAULT_OPENCODE_PORT)
            expect(getEffectivePort(undefined)).toBe(DEFAULT_OPENCODE_PORT)
        })

        it('returns default port when port is invalid', () => {
            expect(getEffectivePort(0)).toBe(DEFAULT_OPENCODE_PORT)
            expect(getEffectivePort(65536)).toBe(DEFAULT_OPENCODE_PORT)
            expect(getEffectivePort(70000)).toBe(DEFAULT_OPENCODE_PORT)
        })

        it('returns default port when port is reserved', () => {
            expect(getEffectivePort(8080)).toBe(DEFAULT_OPENCODE_PORT)
        })
    })

    describe('DEFAULT_OPENCODE_PORT', () => {
        it('should be 4097', () => {
            expect(DEFAULT_OPENCODE_PORT).toBe(4097)
        })
    })
})
