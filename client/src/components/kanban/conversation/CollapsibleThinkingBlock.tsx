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
    const contentId = useId()
    const descriptionId = useId()
    const [open, setOpen] = useState(defaultOpen)
    const actionLabel = open ? `Collapse ${ariaLabel}` : `Expand ${ariaLabel}`

    return (
        <details
            data-slot="thinking-block"
            className={cn(
                'mb-2 rounded border border-border/60 bg-background p-2',
                className,
            )}
            open={open}
            onToggle={(event) => setOpen(event.currentTarget.open)}
        >
            <summary
                data-slot="thinking-summary"
                className="flex cursor-pointer list-none items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-controls={contentId}
                aria-expanded={open}
                aria-describedby={descriptionId}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {headerLeft}
                </div>
                <span data-slot="thinking-toggle" className="text-xs text-muted-foreground" aria-hidden="true">Toggle</span>
                <span id={descriptionId} className="sr-only">{actionLabel}</span>
            </summary>
            <div
                id={contentId}
                data-slot="thinking-content"
                className={cn(
                    'mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground',
                    contentClassName,
                )}
            >
                {text}
            </div>
        </details>
    )
}
