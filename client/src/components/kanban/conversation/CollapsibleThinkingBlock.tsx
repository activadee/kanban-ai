import {useEffect, useRef} from 'react'
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
    defaultOpen = false,
    className,
    contentClassName,
}: CollapsibleThinkingBlockProps) {
    const detailsRef = useRef<HTMLDetailsElement>(null)

    useEffect(() => {
        if (!defaultOpen) return
        if (!detailsRef.current) return
        detailsRef.current.open = true
    }, [defaultOpen])

    return (
        <details
            ref={detailsRef}
            data-slot="thinking-block"
            className={cn(
                'mb-2 rounded border border-border/60 bg-background p-2',
                className,
            )}
        >
            <summary
                data-slot="thinking-summary"
                className="flex cursor-pointer list-none items-center justify-between gap-2"
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {headerLeft}
                </div>
                <span data-slot="thinking-toggle" className="text-xs text-muted-foreground">Toggle</span>
            </summary>
            <div
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
