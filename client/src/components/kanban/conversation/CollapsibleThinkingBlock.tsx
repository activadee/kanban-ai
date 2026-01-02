import {useState} from 'react'
import type {ReactNode} from 'react'
import {cn} from '@/lib/utils'
import {ChevronDown, ChevronRight} from 'lucide-react'

export type CollapsibleThinkingBlockProps = {
    headerLeft: ReactNode
    children: ReactNode
    ariaLabel?: string
    defaultOpen?: boolean
    className?: string
    contentClassName?: string
}

export function CollapsibleThinkingBlock({
    headerLeft,
    children,
    defaultOpen = false,
    className,
    contentClassName,
}: CollapsibleThinkingBlockProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div
            data-slot="thinking-block"
            className={cn(
                'group mb-2 overflow-hidden rounded-lg border transition-all duration-200',
                'border-border/60 bg-background',
                isOpen && 'shadow-sm',
                className,
            )}
        >
            <button
                type="button"
                data-slot="thinking-summary"
                onClick={() => setIsOpen(v => !v)}
                className="flex w-full cursor-pointer list-none items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-muted/50"
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {headerLeft}
                </div>
                <span
                    data-slot="thinking-toggle"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-transform duration-200"
                >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
            </button>
            <div
                data-slot="thinking-content"
                className={cn(
                    'grid transition-all duration-200 ease-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
            >
                <div className="overflow-hidden">
                    <div className={cn(
                        'border-t border-border/40 p-3 text-xs text-muted-foreground',
                        contentClassName,
                    )}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
