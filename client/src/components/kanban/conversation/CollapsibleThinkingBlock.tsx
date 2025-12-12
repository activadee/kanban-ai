import {useId, useState} from 'react'
import type {ReactNode} from 'react'
import {cn} from '@/lib/utils'

export type CollapsibleThinkingBlockProps = {
    headerLeft: ReactNode
    text: string
    ariaLabel?: string
    defaultOpen?: boolean
    className?: string
    contentClassName?: string
}

export function CollapsibleThinkingBlock({
                                            headerLeft,
                                            text,
                                            ariaLabel = 'thinking',
                                            defaultOpen = false,
                                            className,
                                            contentClassName,
                                        }: CollapsibleThinkingBlockProps) {
    const [open, setOpen] = useState(defaultOpen)
    const contentId = useId()
    const actionLabel = open ? `Collapse ${ariaLabel}` : `Expand ${ariaLabel}`

    return (
        <div
            data-slot="thinking-block"
            className={cn(
                'mb-2 rounded border border-border/60 bg-background p-2',
                className,
            )}
        >
            <button
                type="button"
                className="flex w-full cursor-pointer list-none items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-expanded={open}
                aria-controls={contentId}
                aria-label={actionLabel}
                onClick={() => setOpen((v) => !v)}
            >
                <div className="flex min-w-0 items-center gap-2">
                    {headerLeft}
                </div>
                <span data-slot="thinking-toggle" className="text-xs text-muted-foreground">Toggle</span>
                <span className="sr-only">{actionLabel}</span>
            </button>
            <div
                id={contentId}
                aria-hidden={!open}
                className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-in-out',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
            >
                <div className="overflow-hidden">
                    <div
                        data-slot="thinking-content"
                        className={cn(
                            'mt-2 whitespace-pre-wrap text-xs text-muted-foreground transition-opacity duration-200',
                            open ? 'opacity-100' : 'opacity-0',
                            contentClassName,
                        )}
                    >
                        {text}
                    </div>
                </div>
            </div>
        </div>
    )
}
