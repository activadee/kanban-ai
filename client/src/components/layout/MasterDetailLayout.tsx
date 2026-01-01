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
            <div className="hidden w-56 shrink-0 border-r border-border/40 bg-muted/10 md:block">
                <div className="flex h-full flex-col">
                    <div className="border-b border-border/40 px-4 py-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {title}
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? (
                            <div className="flex h-32 items-center justify-center">
                                <div className="text-sm text-muted-foreground">Loading...</div>
                            </div>
                        ) : items.length === 0 && emptyState ? (
                            emptyState
                        ) : (
                            <div className="space-y-1">
                                {items.map((item) => {
                                    const isActive = activeId === item.id
                                    const Icon = item.icon

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onSelect(item.id)}
                                            className={cn(
                                                'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-muted/70',
                                                isActive
                                                    ? 'bg-muted text-foreground shadow-sm'
                                                    : 'text-muted-foreground'
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    'flex size-9 items-center justify-center rounded-lg transition-colors',
                                                    isActive ? 'bg-background' : 'bg-muted/60 group-hover:bg-muted'
                                                )}
                                            >
                                                <Icon className="size-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium">{item.label}</div>
                                                {item.subtitle && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {item.subtitle}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="border-b border-border/40 p-4 md:hidden">
                <Select value={activeId ?? ''} onValueChange={onSelect}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Select ${title.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                                <div className="flex items-center gap-2">
                                    <item.icon className="size-4" />
                                    <span>{item.label}</span>
                                    {item.subtitle && (
                                        <span className="text-xs text-muted-foreground">
                                            ({item.subtitle})
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
    )
}
