import {useId, useState} from 'react'
import type {ReactNode} from 'react'
import {ChevronRight} from 'lucide-react'
import {cn} from '@/lib/utils'

export type CollapsibleThinkingBlockProps = {
    headerLeft: ReactNode
    headerRight?: ReactNode
    text: string
    ariaLabel?: string
    defaultOpen?: boolean
    className?: string
    previewClassName?: string
    contentClassName?: string
}

export function CollapsibleThinkingBlock({
                                            headerLeft,
                                            headerRight,
                                            text,
                                            ariaLabel = 'thinking',
                                            defaultOpen = false,
                                            className,
                                            previewClassName,
                                            contentClassName,
                                        }: CollapsibleThinkingBlockProps) {
    const [open, setOpen] = useState(defaultOpen)
    const contentId = useId()
    const actionLabel = open ? `Collapse ${ariaLabel}` : `Expand ${ariaLabel}`

    return (
        <div
            data-slot="thinking-block"
            className={cn(
                'group mb-2 rounded border border-dashed border-border/60 bg-muted/20 p-2',
                className,
            )}
        >
            <button
                type="button"
                className="flex w-full cursor-pointer flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-expanded={open}
                aria-controls={contentId}
                aria-label={actionLabel}
                onClick={() => setOpen((v) => !v)}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <ChevronRight
                            className={cn(
                                'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                open ? 'rotate-90' : undefined,
                            )}
                        />
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            {headerLeft}
                        </div>
                    </div>
                    {headerRight ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            {headerRight}
                        </div>
                    ) : null}
                </div>
                {!open ? (
                    <div
                        data-slot="thinking-preview"
                        className={cn(
                            'mt-1 line-clamp-1 whitespace-pre-wrap break-words pl-6 text-xs text-muted-foreground',
                            previewClassName,
                        )}
                    >
                        {text}
                    </div>
                ) : null}
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
                            'pt-2 whitespace-pre-wrap text-xs text-muted-foreground transition-opacity duration-200',
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
