import {TICKET_TYPES, TICKET_TYPE_LABELS, type TicketType} from 'shared'

export type TicketTypeOption = { value: TicketType; label: string }

export const ticketTypeOptions: TicketTypeOption[] = TICKET_TYPES.map((type) => ({
    value: type,
    label: TICKET_TYPE_LABELS[type],
}))

const badgeStyleByType: Record<TicketType, { bg: string; text: string; border: string }> = {
    feat: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-l-emerald-500',
    },
    fix: {
        bg: 'bg-red-50 dark:bg-red-950/40',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-l-red-500',
    },
    chore: {
        bg: 'bg-slate-50 dark:bg-slate-900/50',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-l-slate-400',
    },
    docs: {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-200',
        border: 'border-l-amber-500',
    },
    style: {
        bg: 'bg-violet-50 dark:bg-violet-950/40',
        text: 'text-violet-700 dark:text-violet-300',
        border: 'border-l-violet-500',
    },
    refactor: {
        bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
        text: 'text-fuchsia-700 dark:text-fuchsia-300',
        border: 'border-l-fuchsia-500',
    },
    perf: {
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        text: 'text-orange-700 dark:text-orange-200',
        border: 'border-l-orange-500',
    },
    test: {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-l-blue-500',
    },
    build: {
        bg: 'bg-cyan-50 dark:bg-cyan-950/40',
        text: 'text-cyan-700 dark:text-cyan-200',
        border: 'border-l-cyan-500',
    },
    ci: {
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        text: 'text-purple-700 dark:text-purple-200',
        border: 'border-l-purple-500',
    },
    revert: {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-200',
        border: 'border-l-rose-500',
    },
}

export function ticketTypeBadgeClass(type: TicketType | null | undefined): string {
    if (!type) return 'kanban-badge kanban-badge--type bg-muted text-muted-foreground border-l-muted-foreground/30'
    const style = badgeStyleByType[type]
    if (!style) return 'kanban-badge kanban-badge--type bg-muted text-muted-foreground border-l-muted-foreground/30'
    return `kanban-badge kanban-badge--type ${style.bg} ${style.text} ${style.border}`
}

export function getTicketTypeColor(type: TicketType | null | undefined): string {
    const colorMap: Record<TicketType, string> = {
        feat: 'var(--ticket-feat)',
        fix: 'var(--ticket-fix)',
        chore: 'var(--ticket-chore)',
        docs: 'var(--ticket-docs)',
        style: 'var(--ticket-style)',
        refactor: 'var(--ticket-refactor)',
        perf: 'var(--ticket-perf)',
        test: 'var(--ticket-test)',
        build: 'var(--ticket-build)',
        ci: 'var(--ticket-ci)',
        revert: 'var(--ticket-revert)',
    }
    return type ? colorMap[type] ?? 'transparent' : 'transparent'
}

export function formatTicketType(type: TicketType | null | undefined): string {
    if (!type) return 'None'
    return TICKET_TYPE_LABELS[type] ?? type
}

export const defaultTicketType: TicketType = 'feat'
