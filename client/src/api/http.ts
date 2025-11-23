export type ProblemDetails = {
    type?: string
    title?: string
    status?: number
    detail?: string
    [key: string]: unknown
}

export class ApiError extends Error {
    status?: number
    problem?: ProblemDetails

    constructor(message: string, status?: number, problem?: ProblemDetails) {
        super(message)
        this.status = status
        this.problem = problem
    }
}

export async function parseApiResponse<T = unknown>(response: Response): Promise<T> {
    const text = await response.text()
    let data: unknown = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = text || null
    }

    if (!response.ok) {
        const maybeProblem = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
        const hasProblemShape = maybeProblem && ('title' in maybeProblem || 'detail' in maybeProblem || 'type' in maybeProblem || 'status' in maybeProblem)
        const problem = hasProblemShape ? (maybeProblem as ProblemDetails) : undefined
        const message =
            (problem?.detail as string | undefined)?.trim() ||
            (problem?.title as string | undefined)?.trim() ||
            (maybeProblem && typeof maybeProblem.error === 'string' ? maybeProblem.error : undefined) ||
            (typeof data === 'string' && data) ||
            `Request failed (${response.status})`
        const error = new ApiError(message, response.status, problem)
        throw error
    }

    return data as T
}

export function describeApiError(err: unknown, fallbackTitle = 'Request failed'): {
    title: string
    description?: string
    status?: number
    problem?: ProblemDetails
} {
    const apiError = err instanceof ApiError ? err : undefined
    const problem = apiError?.problem
    const status = apiError?.status ?? (problem?.status as number | undefined)
    const description = problem?.detail || (err instanceof Error ? err.message : undefined)
    const title = problem?.title || `${fallbackTitle}${status ? ` (${status})` : ''}`
    return {title, description, status, problem}
}
