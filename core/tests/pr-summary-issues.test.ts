import {describe, expect, it} from 'vitest'

import {
    buildGithubIssueAutoCloseLine,
    appendGithubIssueAutoCloseReferences,
    extractGithubIssueAutoCloseNumbers,
    appendGithubIssueAutoCloseReferencesForRefs,
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
        const body = 'Some text\n\ncloses #12, fixes owner/repo#34\nfix #56\nResolves other/repo#78'
        expect(Array.from(extractGithubIssueAutoCloseNumbers(body)).sort((a, b) => a - b)).toEqual([12, 34, 56, 78])
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

    it('extractGithubIssueAutoCloseNumbers supports punctuation variants', () => {
        const body = 'Closes: #9\nFixes (#10)\nResolved(#11)'
        expect(Array.from(extractGithubIssueAutoCloseNumbers(body)).sort((a, b) => a - b)).toEqual([9, 10, 11])
    })

    it('appendGithubIssueAutoCloseReferencesForRefs emits qualified refs when provided', () => {
        const body = 'Body'
        expect(
            appendGithubIssueAutoCloseReferencesForRefs(body, [
                {issueNumber: 1, owner: 'acme', repo: 'repo'},
                {issueNumber: 2, owner: 'acme', repo: 'repo'},
            ]),
        ).toBe('Body\n\ncloses acme/repo#1, fixes acme/repo#2')
    })
})
