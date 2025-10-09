export function formatRelativeTime(value: string | number | Date | null | undefined): string | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    const diffMs = Date.now() - date.getTime()
    const absMs = Math.abs(diffMs)
    const minutes = Math.floor(absMs / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    const weeks = Math.floor(days / 7)
    if (weeks < 4) return `${weeks}w ago`
    return date.toLocaleDateString()
}

