import {describe, expect, it} from 'vitest'
import {
    assertValidTicketPrefix,
    deriveDefaultTicketPrefix,
    formatTicketKey,
    getDefaultPrefix,
    isValidTicketPrefix,
    sanitizeTicketPrefix,
} from '../src/projects/tickets/ticket-keys'

describe('projects/tickets/ticket-keys', () => {
    it('sanitizes ticket prefixes and enforces uppercase alphanumerics', () => {
        expect(sanitizeTicketPrefix(' dev-prj ')).toBe('DEVPRJ')
        expect(sanitizeTicketPrefix('???')).toBe('PRJ')
    })

    it('derives prefix from project name words', () => {
        expect(deriveDefaultTicketPrefix('My Cool Project')).toBe('MCP')
        expect(deriveDefaultTicketPrefix('123 @!')).toBe('1')
        expect(deriveDefaultTicketPrefix('???')).toBe('PRJ')
    })

    it('validates and asserts ticket prefixes', () => {
        expect(isValidTicketPrefix('ABC123')).toBe(true)
        expect(isValidTicketPrefix('abc')).toBe(false)
        expect(() => assertValidTicketPrefix('bad!')).toThrowError('Invalid ticket prefix')
    })

    it('formats ticket keys and provides default prefix', () => {
        expect(formatTicketKey('ABC', 42)).toBe('ABC-42')
        expect(getDefaultPrefix()).toBe('PRJ')
    })
})
