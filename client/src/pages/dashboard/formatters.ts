export function formatSuccessRate(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—'
    const percentage = value * 100
    if (!Number.isFinite(percentage)) return '—'
    return `${percentage.toFixed(1)}%`
}

export function formatAttemptDuration(
    value: number | null | undefined,
): string {
    if (value == null || !Number.isFinite(value) || value <= 0) return '—'
    const totalSeconds = Math.floor(value)

    if (totalSeconds < 60) {
        return `${totalSeconds}s`
    }

    const minutesTotal = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutesTotal < 60) {
        if (seconds === 0) return `${minutesTotal}m`
        return `${minutesTotal}m ${seconds.toString().padStart(2, '0')}s`
    }

    const hoursTotal = Math.floor(minutesTotal / 60)
    const minutes = minutesTotal % 60

    if (hoursTotal < 24) {
        if (minutes === 0) return `${hoursTotal}h`
        return `${hoursTotal}h ${minutes.toString().padStart(2, '0')}m`
    }

    const days = Math.floor(hoursTotal / 24)
    const remainingHours = hoursTotal % 24

    if (remainingHours === 0) {
        return `${days}d`
    }

    return `${days}d ${remainingHours}h`
}

