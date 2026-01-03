import {describe, expect, it} from 'vitest'

import {buildPrSummaryPrompt, buildTicketEnhancePrompt, splitTicketMarkdown} from '../src/agents/utils'

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

    it('enforces maximum 5 bulletpoints in summary instructions', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })

        expect(prompt).toContain('maximum 5 bulletpoints')
    })

    it('enforces concise bulletpoint length (1-2 lines max)', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })

        expect(prompt).toContain('1-2 lines maximum')
        expect(prompt).toContain('concise')
    })

    it('prioritizes high-impact changes in instructions', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })

        expect(prompt).toContain('most impactful changes')
        expect(prompt).toContain('omit trivial')
    })

    it('requires clear actionable language in bulletpoints', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })

        expect(prompt).toContain('actionable language')
        expect(prompt).toMatch(/Add.*Fix.*Update.*Remove/s)
    })

    it('maintains proper Markdown formatting requirements', () => {
        const prompt = buildPrSummaryPrompt({
            repositoryPath: '/tmp/repo',
            baseBranch: 'main',
            headBranch: 'feature/test',
        })

        expect(prompt).toContain('Markdown')
        expect(prompt).toContain('First line: # <')
        expect(prompt).toContain('Respond only with the PR Markdown content')
    })
})

describe('agents/utils buildTicketEnhancePrompt', () => {
    const baseInput = {
        projectId: 'p1',
        boardId: 'b1',
        repositoryPath: '/repo',
        baseBranch: 'main',
        title: 'Add login',
        description: 'Implement basic login form',
        signal: new AbortController().signal,
    }

    it('includes ticket type when provided', () => {
        const prompt = buildTicketEnhancePrompt({...baseInput, ticketType: 'feat'})
        expect(prompt).toContain('Type: feat')
    })

    it('omits ticket type when not set', () => {
        const prompt = buildTicketEnhancePrompt(baseInput)
        expect(prompt).not.toContain('Type:')
    })

    it('uses custom prompt when provided', () => {
        const prompt = buildTicketEnhancePrompt({
            ...baseInput,
            customPrompt: 'You are a specialized ticket writer for React projects.',
        })
        expect(prompt).toContain('You are a specialized ticket writer for React projects.')
        // Should NOT contain the default prompt
        expect(prompt).not.toContain('Before writing the ticket, analyze the repository')
    })

    it('appends input context to custom prompt', () => {
        const prompt = buildTicketEnhancePrompt({
            ...baseInput,
            customPrompt: 'Custom instructions here.',
        })
        expect(prompt).toContain('Input:')
        expect(prompt).toContain('Title: Add login')
        expect(prompt).toContain('Description:')
        expect(prompt).toContain('Implement basic login form')
    })

    it('appends output format requirements to custom prompt', () => {
        const prompt = buildTicketEnhancePrompt({
            ...baseInput,
            customPrompt: 'Custom instructions here.',
        })
        expect(prompt).toContain('Output format requirements (MUST follow):')
        expect(prompt).toContain('First line MUST be: # <Title>')
        expect(prompt).toContain('Markdown format')
    })

    it('includes append prompt with custom prompt', () => {
        const prompt = buildTicketEnhancePrompt(
            {...baseInput, customPrompt: 'Custom base.'},
            'Additional instructions from profile.',
        )
        expect(prompt).toContain('Custom base.')
        expect(prompt).toContain('Additional instructions from profile.')
    })

    it('has proper newline separation in custom prompt', () => {
        const prompt = buildTicketEnhancePrompt({
            ...baseInput,
            customPrompt: 'Custom prompt ending without newline',
        })
        // The custom prompt should be followed by a newline before Input:
        expect(prompt).toMatch(/Custom prompt ending without newline\n+\nInput:/)
    })
})

describe('agents/utils buildPrSummaryPrompt with custom prompt', () => {
    const baseInput = {
        repositoryPath: '/tmp/repo',
        baseBranch: 'main',
        headBranch: 'feature/test',
    }

    it('uses custom prompt when provided', () => {
        const prompt = buildPrSummaryPrompt({
            ...baseInput,
            customPrompt: 'You are a PR writer focusing on API changes.',
        })
        expect(prompt).toContain('You are a PR writer focusing on API changes.')
        // Should NOT contain the default prompt intro
        expect(prompt).not.toContain('You are a pull request generator for a software project.')
    })

    it('appends repository context to custom prompt', () => {
        const prompt = buildPrSummaryPrompt({
            ...baseInput,
            customPrompt: 'Custom PR instructions.',
        })
        expect(prompt).toContain('Repository context:')
        expect(prompt).toContain('Base branch: main')
        expect(prompt).toContain('Head branch: feature/test')
    })

    it('appends output format requirements to custom prompt', () => {
        const prompt = buildPrSummaryPrompt({
            ...baseInput,
            customPrompt: 'Custom PR instructions.',
        })
        expect(prompt).toContain('Output format requirements (MUST follow):')
        expect(prompt).toContain('First line MUST be: # <PR Title>')
        expect(prompt).toContain('maximum 5 bulletpoints')
        expect(prompt).toContain('1-2 lines maximum')
    })

    it('includes commit and diff summaries with custom prompt', () => {
        const prompt = buildPrSummaryPrompt({
            ...baseInput,
            customPrompt: 'Custom instructions.',
            commitSummary: 'abc123 Fix bug',
            diffSummary: '2 files changed',
        })
        expect(prompt).toContain('Commits (base..head):')
        expect(prompt).toContain('abc123 Fix bug')
        expect(prompt).toContain('Diff summary (files and stats):')
        expect(prompt).toContain('2 files changed')
    })

    it('includes append prompt with custom prompt', () => {
        const prompt = buildPrSummaryPrompt(
            {...baseInput, customPrompt: 'Custom base.'},
            'Additional profile instructions.',
        )
        expect(prompt).toContain('Custom base.')
        expect(prompt).toContain('Additional profile instructions.')
    })

    it('has proper newline separation in custom prompt', () => {
        const prompt = buildPrSummaryPrompt({
            ...baseInput,
            customPrompt: 'Custom prompt without trailing newline',
        })
        // Should have proper separation before Repository context
        expect(prompt).toMatch(/Custom prompt without trailing newline\n+\nRepository context:/)
    })
})
