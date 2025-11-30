import {TICKET_TYPES, TICKET_TYPE_LABELS, type TicketType} from 'shared'

export type TicketTypeOption = { value: TicketType; label: string }

export const ticketTypeOptions: TicketTypeOption[] = TICKET_TYPES.map((type) => ({
    value: type,
    label: TICKET_TYPE_LABELS[type],
}))

const badgeClassByType: Record<TicketType, string> = {
    feat: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-800',
    fix: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-red-200/70 dark:border-red-800',
    chore: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200 border-slate-200/70 dark:border-slate-800',
    docs: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 border-amber-200/70 dark:border-amber-800',
    style: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 border-indigo-200/70 dark:border-indigo-800',
    refactor: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200 border-fuchsia-200/70 dark:border-fuchsia-800',
    perf: 'bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100 border-orange-200/70 dark:border-orange-800',
    test: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200/70 dark:border-blue-800',
    build: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-100 border-cyan-200/70 dark:border-cyan-800',
    ci: 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100 border-purple-200/70 dark:border-purple-800',
    revert: 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100 border-rose-200/70 dark:border-rose-800',
}

export function ticketTypeBadgeClass(type: TicketType | null | undefined): string {
    if (!type) return 'bg-muted text-muted-foreground border-border'
    return badgeClassByType[type] ?? 'bg-muted text-muted-foreground border-border'
}

export function formatTicketType(type: TicketType | null | undefined): string {
    if (!type) return 'None'
    return TICKET_TYPE_LABELS[type] ?? type
}

export const defaultTicketType: TicketType = 'feat'
