import {z} from 'zod'

export const stopAttemptSchema = z.object({
    status: z.enum(['stopped']),
})

export const attemptMessageSchema = z.object({
    prompt: z.string().min(1),
    profileId: z.string().optional(),
})

export const openEditorSchema = z.object({
    subpath: z.string().optional(),
    editorKey: z.string().optional(),
})

export const gitCommitSchema = z.object({
    subject: z.string().min(1),
    body: z.string().optional(),
})

export const gitPushSchema = z.object({
    setUpstream: z.boolean().optional(),
})

export const attemptPrSchema = z.object({
    base: z.string().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    draft: z.boolean().optional(),
})

// Canonical schema for starting an attempt for a board/card
export const startAttemptSchema = z.object({
    // Only stable, supported agents are allowed here.
    // Experimental agents (Droid/OpenCode) are WIP, not usable,
    // and intentionally excluded from this schema.
    agent: z.enum(['ECHO', 'SHELL', 'CODEX']),
    profileId: z.string().optional(),
    baseBranch: z.string().min(1).optional(),
    branchName: z.string().min(1).optional(),
})
