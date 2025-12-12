import {useId} from 'react'
import type {ReactNode} from 'react'
import {cn} from '@/lib/utils'

export type CollapsibleThinkingBlockProps = {
    headerLeft: ReactNode
    text: string
    ariaLabel?: string
    className?: string
    contentClassName?: string
}

export function CollapsibleThinkingBlock({
                                            headerLeft,
                                            text,
                                            ariaLabel = 'thinking',
                                            className,
                                            contentClassName,
                                        }: CollapsibleThinkingBlockProps) {
    const contentId = useId()

    return (
        <details
            data-slot="thinking-block"
            className={cn(
                'mb-2 rounded border border-border/60 bg-background p-2',
                className,
            )}
        >
            <summary
                data-slot="thinking-summary"
                className="flex cursor-pointer list-none items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label={ariaLabel}
                aria-controls={contentId}
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {headerLeft}
                </div>
                <span data-slot="thinking-toggle" className="text-xs text-muted-foreground">Toggle</span>
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
