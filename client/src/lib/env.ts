// Default API base
// - Dev: http://localhost:3000/api/v1
// - Prod: window.location.origin + '/api/v1'
// Still overrideable via VITE_SERVER_URL
const DEV_DEFAULT = 'http://localhost:3000/api/v1'

function defaultApiBase() {
    // In dev we want to talk to the separate API server (defaults to :3000).
    if (import.meta.env.DEV) return DEV_DEFAULT

    if (typeof window !== 'undefined') {
        return `${window.location.origin.replace(/\/?$/, '')}/api/v1`
    }

    return DEV_DEFAULT
}

export function resolveApiBase() {
    return (import.meta.env.VITE_SERVER_URL || defaultApiBase()).replace(/\/?$/, '')
}

export const SERVER_URL = resolveApiBase()
