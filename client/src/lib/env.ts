// Default API base
// - Dev: http://localhost:3000/api
// - Prod: window.location.origin + '/api'
// Still overrideable via VITE_SERVER_URL
const DEV_DEFAULT = 'http://localhost:3000/api'

function defaultApiBase() {
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
        return `${window.location.origin.replace(/\/?$/, '')}/api`
    }
    return DEV_DEFAULT
}

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || defaultApiBase()).replace(/\/?$/, '')
