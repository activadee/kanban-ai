import * as React from 'react'

import {cn} from '@/lib/utils'

export type PageHeaderProps = Omit<React.ComponentPropsWithoutRef<'header'>, 'children' | 'title'> & {
    title: React.ReactNode
    description?: React.ReactNode
    kicker?: React.ReactNode
    titleAccessory?: React.ReactNode
    actions?: React.ReactNode
    children?: React.ReactNode
    containerClassName?: string
    testId?: string
}

export function PageHeader({
    title,
    description,
    kicker,
    titleAccessory,
    actions,
    children,
    className,
    containerClassName,
    testId = 'page-header',
    ...props
}: PageHeaderProps) {
    return (
        <header
            data-component="PageHeader"
            data-testid={testId}
            className={cn(
                'border-b border-border/60 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50',
                className,
            )}
            {...props}
        >
            <div
                className={cn(
                    'mx-auto flex w-full flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8',
                    containerClassName,
                )}
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-1">
                        {kicker ? (
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {kicker}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold leading-tight text-foreground">
                                {title}
                            </h1>
                            {titleAccessory}
                        </div>
                        {description ? (
                            <div className="text-sm text-muted-foreground">
                                {description}
                            </div>
                        ) : null}
                    </div>
                    {actions ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {actions}
                        </div>
                    ) : null}
                </div>
                {children ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {children}
                    </div>
                ) : null}
            </div>
        </header>
    )
}

