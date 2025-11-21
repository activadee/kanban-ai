// Default API base
// - Dev: http://localhost:3000/api/v1
// - Prod: window.location.origin + '/api/v1'
// Still overrideable via VITE_SERVER_URL
const DEV_DEFAULT = 'http://localhost:3000/api/v1'

function defaultApiBase() {
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
        return `${window.location.origin.replace(/\/?$/, '')}/api/v1`
    }
    return DEV_DEFAULT
}

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || defaultApiBase()).replace(/\/?$/, '')
