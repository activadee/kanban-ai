import * as React from 'react'

import {cn} from '@/lib/utils'

export type PageHeaderProps = Omit<React.ComponentPropsWithoutRef<'header'>, 'children' | 'title'> & {
    title: React.ReactNode
    description?: React.ReactNode
    kicker?: React.ReactNode
    titleAccessory?: React.ReactNode
    /** Primary actions rendered on the right side of the header */
    actions?: React.ReactNode
    /** Secondary controls rendered below actions (e.g. sort, filters) */
    controls?: React.ReactNode
    children?: React.ReactNode
    containerClassName?: string
    testId?: string
    /** Compact variant for board pages - reduces vertical padding */
    variant?: 'default' | 'compact'
}

export function PageHeader({
    title,
    description,
    kicker,
    titleAccessory,
    actions,
    controls,
    children,
    className,
    containerClassName,
    testId = 'page-header',
    variant = 'default',
    ...props
}: PageHeaderProps) {
    const isCompact = variant === 'compact'

    return (
        <header
            data-component="PageHeader"
            data-testid={testId}
            className={cn(
                'relative border-b border-border/50 bg-gradient-to-b from-background to-muted/20',
                className,
            )}
            {...props}
        >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
            
            <div
                className={cn(
                    'mx-auto flex w-full flex-col gap-2 px-4 sm:px-6 lg:px-8',
                    isCompact ? 'py-3' : 'py-4',
                    containerClassName,
                )}
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                        {kicker ? (
                            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                                {kicker}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className={cn(
                                'font-semibold leading-tight tracking-tight text-foreground',
                                isCompact ? 'text-lg' : 'text-xl'
                            )}>
                                {title}
                            </h1>
                            {titleAccessory ? (
                                <span className="flex items-center">
                                    {titleAccessory}
                                </span>
                            ) : null}
                        </div>
                        {description ? (
                            <p className="mt-1 text-sm text-muted-foreground/80">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    
                    {(actions || controls) ? (
                        <div className="flex flex-wrap items-center gap-3">
                            {controls ? (
                                <div className="flex items-center gap-2 text-sm">
                                    {controls}
                                </div>
                            ) : null}
                            {actions ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    {actions}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                {children ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {children}
                    </div>
                ) : null}
            </div>
        </header>
    )
}

