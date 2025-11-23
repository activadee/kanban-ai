import {STATUS_CODES} from 'node:http'
import type {Context} from 'hono'

export type ProblemDetails = {
    type: string
    title: string
    status: number
    detail?: string
    instance?: string
    [key: string]: unknown
}

const DEFAULT_TYPE = 'about:blank'

export function normalizeProblem(problem: Partial<ProblemDetails> & {status: number}): ProblemDetails {
    return {
        ...problem,
        type: problem.type ?? DEFAULT_TYPE,
        title: problem.title ?? STATUS_CODES[problem.status] ?? 'Error',
        status: problem.status,
        detail: problem.detail ?? undefined,
        instance: problem.instance,
    }
}

export function problemJson(c: Context, problem: Partial<ProblemDetails> & {status: number}) {
    const payload = normalizeProblem(problem)
    return c.json(payload, payload.status as any)
}

export class ProblemError extends Error {
    status: number
    type?: string
    title?: string
    detail?: string

    constructor(problem: Partial<ProblemDetails> & {status: number}) {
        super(problem.detail ?? problem.title ?? STATUS_CODES[problem.status] ?? 'Error')
        this.status = problem.status
        this.type = problem.type
        this.title = problem.title
        this.detail = problem.detail ?? this.message
    }

    toProblem(): ProblemDetails {
        return normalizeProblem({
            status: this.status,
            type: this.type,
            title: this.title,
            detail: this.detail ?? this.message,
        })
    }
}
