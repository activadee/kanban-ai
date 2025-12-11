export function formatSuccessRate(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—'
    const percentage = value * 100
    if (!Number.isFinite(percentage)) return '—'
    return `${percentage.toFixed(1)}%`
}

