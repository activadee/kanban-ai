import {describe, expect, it} from 'vitest'
import {isValidPort, getEffectivePort, DEFAULT_OPENCODE_PORT} from '../src/agents/opencode/core/agent'
import type {OpencodeProfile} from '../src/agents/opencode/profiles/schema'

describe('Port Configuration', () => {
    describe('isValidPort', () => {
        it('should return true for null or undefined ports', () => {
            expect(isValidPort(null)).toBe(true)
            expect(isValidPort(undefined)).toBe(true)
        })

        it('should return true for valid port numbers in range 1-65535', () => {
            expect(isValidPort(1)).toBe(true)
            expect(isValidPort(80)).toBe(false) // Reserved
            expect(isValidPort(443)).toBe(false) // Reserved
            expect(isValidPort(8080)).toBe(false) // Reserved
            expect(isValidPort(4097)).toBe(true)
            expect(isValidPort(5000)).toBe(true)
            expect(isValidPort(65535)).toBe(true)
        })

        it('should return false for invalid port numbers', () => {
            expect(isValidPort(0)).toBe(false)
            expect(isValidPort(-1)).toBe(false)
            expect(isValidPort(65536)).toBe(false)
            expect(isValidPort(100000)).toBe(false)
            expect(isValidPort(1.5)).toBe(false)
            expect(isValidPort(Infinity)).toBe(false)
            expect(isValidPort(NaN)).toBe(false)
        })

        it('should reject reserved ports', () => {
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
        it('should return the configured port when valid', () => {
            const profile: OpencodeProfile = {port: 5000}
            expect(getEffectivePort(profile)).toBe(5000)
        })

        it('should return default port when port is null', () => {
            const profile: OpencodeProfile = {port: null}
            expect(getEffectivePort(profile)).toBe(DEFAULT_OPENCODE_PORT)
        })

        it('should return default port when port is undefined', () => {
            const profile: OpencodeProfile = {}
            expect(getEffectivePort(profile)).toBe(DEFAULT_OPENCODE_PORT)
        })

        it('should return default port when port is invalid', () => {
            const profile: OpencodeProfile = {port: 70000}
            expect(getEffectivePort(profile)).toBe(DEFAULT_OPENCODE_PORT)
        })

        it('should return default port when port is reserved', () => {
            const profile: OpencodeProfile = {port: 8080}
            expect(getEffectivePort(profile)).toBe(DEFAULT_OPENCODE_PORT)
        })

        it('should return the default port (4097) for valid profiles', () => {
            const profile: OpencodeProfile = {port: 4097}
            expect(getEffectivePort(profile)).toBe(4097)
            expect(getEffectivePort(profile)).toBe(DEFAULT_OPENCODE_PORT)
        })
    })

    describe('DEFAULT_OPENCODE_PORT', () => {
        it('should be 4097', () => {
            expect(DEFAULT_OPENCODE_PORT).toBe(4097)
        })
    })
})

describe('Port Configuration in Profile Schema', () => {
    it('should accept valid port numbers', () => {
        const validProfiles = [
            {port: 4097},
            {port: 5000},
            {port: 8081},
            {port: 65535},
            {port: 1},
        ]
        // These would typically be validated by the schema, we're testing the validation logic
        for (const profile of validProfiles) {
            if (profile.port !== undefined) {
                expect(isValidPort(profile.port)).toBe(true)
            }
        }
    })

    it('should reject invalid port numbers through validation', () => {
        const invalidPorts = [0, -1, 65536, 70000]
        for (const port of invalidPorts) {
            expect(isValidPort(port)).toBe(false)
        }
    })
})