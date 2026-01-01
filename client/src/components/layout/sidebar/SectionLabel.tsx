import {cn} from '@/lib/utils'

export function SectionLabel({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                className
            )}
        >
            {children}
        </div>
    )
}
