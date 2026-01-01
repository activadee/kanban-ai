import type {LucideIcon} from 'lucide-react'
import type {ReactNode} from 'react'
import {cn} from '@/lib/utils'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'

export interface MasterDetailItem {
    id: string
    label: string
    subtitle?: string
    icon: LucideIcon
}

interface MasterDetailLayoutProps {
    title: string
    items: MasterDetailItem[]
    activeId: string | null
    onSelect: (id: string) => void
    children: ReactNode
    emptyState?: ReactNode
    loading?: boolean
}

export function MasterDetailLayout({
    title,
    items,
    activeId,
    onSelect,
    children,
    emptyState,
    loading,
}: MasterDetailLayoutProps) {
    return (
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
            <aside className="hidden w-60 shrink-0 border-r border-border/50 bg-background md:block">
                <div className="flex h-full flex-col">
                    <header className="px-5 py-4">
                        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                            {title}
                        </h2>
                    </header>

                    <nav className="flex-1 overflow-y-auto px-3 pb-4">
                        {loading ? (
                            <div className="flex h-32 items-center justify-center">
                                <div className="text-sm text-muted-foreground/60">Loading...</div>
                            </div>
                        ) : items.length === 0 && emptyState ? (
                            emptyState
                        ) : (
                            <ul className="space-y-0.5">
                                {items.map((item) => {
                                    const isActive = activeId === item.id
                                    const Icon = item.icon

                                    return (
                                        <li key={item.id}>
                                            <button
                                                onClick={() => onSelect(item.id)}
                                                className={cn(
                                                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                                                    'transition-all duration-150 ease-out',
                                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                                    isActive
                                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
                                                        'transition-all duration-200 ease-out',
                                                        isActive
                                                            ? 'bg-sidebar-primary opacity-100'
                                                            : 'bg-transparent opacity-0 group-hover:bg-muted-foreground/30 group-hover:opacity-100'
                                                    )}
                                                />
                                                <span
                                                    className={cn(
                                                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                                                        'transition-all duration-150 ease-out',
                                                        isActive
                                                            ? 'bg-sidebar-primary/10 text-sidebar-primary'
                                                            : 'bg-transparent text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground'
                                                    )}
                                                >
                                                    <Icon
                                                        className={cn(
                                                            'size-[18px] transition-transform duration-150',
                                                            'group-hover:scale-105',
                                                            isActive && 'scale-105'
                                                        )}
                                                        strokeWidth={isActive ? 2 : 1.75}
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className={cn(
                                                            'block truncate text-[13px] leading-tight',
                                                            'transition-colors duration-150',
                                                            isActive ? 'font-medium' : 'font-normal'
                                                        )}
                                                    >
                                                        {item.label}
                                                    </span>
                                                    {item.subtitle && (
                                                        <span
                                                            className={cn(
                                                                'mt-0.5 block truncate text-[11px] leading-tight',
                                                                'transition-colors duration-150',
                                                                isActive
                                                                    ? 'text-sidebar-foreground/60'
                                                                    : 'text-muted-foreground/60'
                                                            )}
                                                        >
                                                            {item.subtitle}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </nav>
                </div>
            </aside>

            <div className="border-b border-border/50 bg-background p-3 md:hidden">
                <Select value={activeId ?? ''} onValueChange={onSelect}>
                    <SelectTrigger className="w-full bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent transition-colors">
                        <SelectValue placeholder={`Select ${title.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent className="bg-sidebar border-sidebar-border">
                        {items.map((item) => (
                            <SelectItem
                                key={item.id}
                                value={item.id}
                                className="focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
                            >
                                <span className="flex items-center gap-2.5">
                                    <span
                                        className={cn(
                                            'flex size-6 items-center justify-center rounded',
                                            activeId === item.id
                                                ? 'bg-sidebar-primary/10 text-sidebar-primary'
                                                : 'text-muted-foreground'
                                        )}
                                    >
                                        <item.icon className="size-4" strokeWidth={activeId === item.id ? 2 : 1.75} />
                                    </span>
                                    <span className={cn('text-[13px]', activeId === item.id && 'font-medium')}>
                                        {item.label}
                                    </span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        </div>
    )
}
