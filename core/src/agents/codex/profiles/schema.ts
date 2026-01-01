import {z} from 'zod'
import type {CodexProfile as SharedCodexProfile} from 'shared'
import {BaseProfileSchema} from '../../profiles/base'

export const CodexProfileSchema = BaseProfileSchema.extend({
    sandbox: z
        .enum(['read-only', 'workspace-write', 'danger-full-access', 'auto'])
        .optional(),
    model: z.string().optional(),
    modelReasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
    skipGitRepoCheck: z.boolean().optional(),
    networkAccessEnabled: z.boolean().optional(),
    webSearchEnabled: z.boolean().optional(),
    approvalPolicy: z.enum(['never', 'on-request', 'on-failure', 'untrusted']).optional(),
    additionalDirectories: z.array(z.string()).optional(),
    outputSchema: z.unknown().optional(),
})

export type CodexProfile = z.infer<typeof CodexProfileSchema>

export const defaultProfile: SharedCodexProfile = {
    sandbox: 'workspace-write',
    skipGitRepoCheck: true,
    debug: false,
}
