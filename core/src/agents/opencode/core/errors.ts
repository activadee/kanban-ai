/**
 * OpenCode error handling utilities.
 */

export function stringifyShort(value: unknown): string {
    try {
        const json = JSON.stringify(value)
        if (!json) return ''
        return json.length > 500 ? json.slice(0, 497) + '...' : json
    } catch {
        return ''
    }
}

export function describeOpencodeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message || String(err)
    }
    if (typeof err === 'string') {
        const trimmed = err.trim()
        return trimmed || 'Unknown OpenCode error'
    }
    if (!err || typeof err !== 'object') {
        return 'Unknown OpenCode error'
    }

    const record = err as Record<string, unknown>
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    if (message) return message

    const data = record.data
    if (data && typeof data === 'object') {
        const dataMsg = (data as Record<string, unknown>).message
        if (typeof dataMsg === 'string') {
            const trimmed = dataMsg.trim()
            if (trimmed) return trimmed
        }
    }

    const json = stringifyShort(err)
    if (json) return json

    return String(err)
}

export function asOpencodeError(err: unknown, fallback: string): Error {
    const msg = describeOpencodeError(err)
    const message = msg && msg !== '[object Object]' ? msg : fallback
    return err === undefined ? new Error(message) : new Error(message, {cause: err})
}
