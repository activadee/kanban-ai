export const TICKET_TYPES = [
    'feat',
    'fix',
    'chore',
    'docs',
    'style',
    'refactor',
    'perf',
    'test',
    'build',
    'ci',
    'revert',
] as const

export type TicketType = (typeof TICKET_TYPES)[number]

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
    feat: 'Feature',
    fix: 'Fix',
    chore: 'Chore',
    docs: 'Docs',
    style: 'Style',
    refactor: 'Refactor',
    perf: 'Performance',
    test: 'Test',
    build: 'Build',
    ci: 'CI',
    revert: 'Revert',
}
