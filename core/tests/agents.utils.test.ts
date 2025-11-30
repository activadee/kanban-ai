import {describe, expect, it} from 'vitest'

import {buildPrSummaryPrompt, splitTicketMarkdown} from '../src/agents/utils'

describe('agents/utils splitTicketMarkdown', () => {
    it('extracts title from H1 on first line and uses remaining text as description', () => {
        const markdown = '# My Title\nThis is the description.\nWith multiple lines.'

        const result = splitTicketMarkdown(markdown, 'Fallback Title', 'Fallback Description')

        expect(result).toEqual({
            title: 'My Title',
            description: 'This is the description.\nWith multiple lines.',
        })
    })

    it('falls back when no H1 is present', () => {
        const markdown = 'Just some text\nwithout any heading.'

        const result = splitTicketMarkdown(markdown, 'Fallback Title', 'Fallback Description')

        expect(result).toEqual({
            title: 'Fallback Title',
            description: 'Fallback Description',
        })
    })

    it('handles extra whitespace before and after content', () => {
        const markdown = `
            
            #   Spaced Title   


            Description with extra whitespace.    
            
        `

        const result = splitTicketMarkdown(markdown, 'Fallback Title', 'Fallback Description')

        expect(result).toEqual({
            title: 'Spaced Title',
            description: 'Description with extra whitespace.',
        })
    })

    it('handles H1 with trailing spaces', () => {
        const markdown = '# Title With Spaces   \nBody text here.'

        const result = splitTicketMarkdown(markdown, 'Fallback Title', 'Fallback Description')

        expect(result).toEqual({
            title: 'Title With Spaces',
            description: 'Body text here.',
        })
    })
})

describe('agents/utils buildPrSummaryPrompt', () => {
    it('includes repository path and branch names', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })

        expect(prompt).toContain('Repository path: /tmp/repo')
        expect(prompt).toContain('Base branch: main')
        expect(prompt).toContain('Head branch: feature/test')
    })

    it('embeds commit and diff summaries when provided', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
            commitSummary: 'abc123 Add feature',
            diffSummary: '3 files changed',
        })

        expect(prompt).toContain('Commits (base..head):')
        expect(prompt).toContain('abc123 Add feature')
        expect(prompt).toContain('Diff summary (files and stats):')
        expect(prompt).toContain('3 files changed')
    })
})

