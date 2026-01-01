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
                'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                'transition-all duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
        >
            <span
                className={cn(
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
                    'transition-all duration-200 ease-out',
                    active
                        ? 'bg-sidebar-primary opacity-100'
                        : 'bg-transparent opacity-0 group-hover:bg-muted-foreground/30 group-hover:opacity-100'
                )}
            />
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md',
                    'transition-all duration-150 ease-out',
                    active
                        ? 'bg-sidebar-primary/10 text-sidebar-primary'
                        : 'bg-transparent text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground'
                )}
            >
                <Icon
                    className={cn(
                        'size-[18px] transition-transform duration-150',
                        'group-hover:scale-105',
                        active && 'scale-105'
                    )}
                    strokeWidth={active ? 2 : 1.75}
                />
            </span>
            <span
                className={cn(
                    'flex-1 truncate text-[13px] leading-tight text-left',
                    'transition-colors duration-150',
                    active ? 'font-medium' : 'font-normal'
                )}
            >
                {label}
            </span>
            {badge ? (
                <span className="text-xs text-muted-foreground/70">{badge}</span>
            ) : null}
            {shortcut ? (
                <kbd className="hidden sm:inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/60 bg-muted/50 px-1 text-[10px] font-medium text-muted-foreground">
                    {shortcut}
                </kbd>
            ) : null}
        </button>
    )
}

