import type {HTMLAttributes, ReactNode} from 'react'
import {Button} from '@/components/ui/button'

export type SectionState = 'idle' | 'loading' | 'success' | 'empty' | 'error'

type ResolveSectionStateOptions = {
    isLoading: boolean
    hasError: boolean
    hasData: boolean
}

export function resolveSectionState({
                                        isLoading,
                                        hasError,
                                        hasData,
                                    }: ResolveSectionStateOptions): SectionState {
    if (isLoading) return 'loading'
    if (hasError) return 'error'
    if (hasData) return 'success'
    return 'empty'
}

type SectionEmptyStateProps = {
    title: string
    description?: string
    action?: ReactNode
} & HTMLAttributes<HTMLDivElement>

export function SectionEmptyState({
                                      title,
                                      description,
                                      action,
                                      className,
                                      ...rest
                                  }: SectionEmptyStateProps) {
    return (
        <div
            className={`mt-2 rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground ${className ?? ''}`}
            {...rest}
        >
            <div className="font-medium text-foreground/80">{title}</div>
            {description ? (
                <div className="mt-1 text-xs text-muted-foreground">
                    {description}
                </div>
            ) : null}
            {action ? <div className="mt-2">{action}</div> : null}
        </div>
    )
}

type SectionErrorBannerProps = {
    title: string
    description?: string
    retryLabel?: string
    onRetry?: () => void
} & HTMLAttributes<HTMLDivElement>

export function SectionErrorBanner({
                                       title,
                                       description,
                                       retryLabel = 'Retry',
                                       onRetry,
                                       className,
                                       ...rest
                                   }: SectionErrorBannerProps) {
    return (
        <div
            className={`flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive ${className ?? ''}`}
            role="status"
            {...rest}
        >
            <div>
                <div className="font-medium">
                    {title}
                </div>
                {description ? (
                    <div className="mt-1 opacity-80">
                        {description}
                    </div>
                ) : null}
            </div>
            {onRetry ? (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-destructive/40 px-2 text-[11px]"
                    onClick={onRetry}
                >
                    {retryLabel}
                </Button>
            ) : null}
        </div>
    )
}

