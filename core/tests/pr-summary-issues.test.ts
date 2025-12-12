import {describe, expect, it} from 'vitest'

import {
    buildGithubIssueAutoCloseLine,
    appendGithubIssueAutoCloseReferences,
    extractGithubIssueAutoCloseNumbers,
} from '../src/agents/pr-summary-issues'

describe('agents/pr-summary-issues', () => {
    it('buildGithubIssueAutoCloseLine returns null for no issues', () => {
        expect(buildGithubIssueAutoCloseLine([])).toBeNull()
    })

    it('buildGithubIssueAutoCloseLine formats a single issue', () => {
        expect(buildGithubIssueAutoCloseLine([123])).toBe('closes #123')
    })

    it('buildGithubIssueAutoCloseLine formats multiple issues with closes/fixes', () => {
        expect(buildGithubIssueAutoCloseLine([456, 123])).toBe('closes #123, fixes #456')
    })

    it('extractGithubIssueAutoCloseNumbers finds existing references', () => {
        const body = 'Some text\n\ncloses #12, fixes #34\nResolves #56'
        expect(Array.from(extractGithubIssueAutoCloseNumbers(body)).sort((a, b) => a - b)).toEqual([12, 34, 56])
    })

    it('appendGithubIssueAutoCloseReferences appends missing references', () => {
        const body = 'Body'
        expect(appendGithubIssueAutoCloseReferences(body, [123, 456])).toBe(
            'Body\n\ncloses #123, fixes #456',
        )
    })

    it('appendGithubIssueAutoCloseReferences does not duplicate existing references', () => {
        const body = 'Body\n\ncloses #123'
        expect(appendGithubIssueAutoCloseReferences(body, [123, 456])).toBe(
            'Body\n\ncloses #123\n\ncloses #456',
        )
    })

    it('appendGithubIssueAutoCloseReferences returns body unchanged when all references already exist', () => {
        const body = 'Body\n\ncloses #123, fixes #456'
        expect(appendGithubIssueAutoCloseReferences(body, [123, 456])).toBe(body)
    })
})

