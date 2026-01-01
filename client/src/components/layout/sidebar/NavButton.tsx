import type {ComponentType, SVGProps} from 'react'
import {cn} from '@/lib/utils'

export function NavButton({
    icon: Icon,
    label,
    active,
    onClick,
    badge,
    shortcut,
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>
    label: string
    active?: boolean
    onClick?: () => void
    badge?: React.ReactNode
    shortcut?: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-muted/70',
                active ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground',
            )}
        >
            <Icon className="size-4"/>
            <span className="flex-1 text-left font-medium">{label}</span>
            {badge ? <span className="text-xs text-muted-foreground">{badge}</span> : null}
            {shortcut ? (
                <kbd className="hidden sm:inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/60 bg-muted/50 px-1 text-[10px] font-medium text-muted-foreground">
                    {shortcut}
                </kbd>
            ) : null}
        </button>
    )
}

