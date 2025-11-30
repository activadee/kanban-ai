import {sanitizeTicketPrefix} from '../projects/tickets/ticket-keys'

function slugify(input: string, max = 64): string {
    const base = (input || 'untitled')
        .normalize('NFKD')
        .replace(/[^\w\-\s.]+/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .toLowerCase()
    const s = base || 'untitled'
    return s.slice(0, max)
}

export function renderBranchName(template: string, ctx: {
    prefix?: string | null;
    ticketKey?: string | null;
    slugSource?: string | null;
    type?: string | null;
}): string {
    const prefix = sanitizeTicketPrefix(ctx.prefix ?? undefined)
    const slug = slugify(ctx.slugSource ?? ctx.ticketKey ?? prefix ?? 'change')
    const ticketKey = (ctx.ticketKey ?? '').trim()
    const type = (ctx.type ?? '').trim().toLowerCase()
    let name = template
        .replaceAll('{prefix}', prefix)
        .replaceAll('{ticketKey}', ticketKey)
        .replaceAll('{type}', type)
        .replaceAll('{slug}', slug)
    name = name.replace(/\/+/, '/').replace(/^\/+|\/+$/g, '')
    if (!name) name = `kanbanai/${slug}`
    return name
}
