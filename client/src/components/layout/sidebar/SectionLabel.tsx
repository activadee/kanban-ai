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
                'px-5 py-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70',
                className
            )}
        >
            {children}
        </div>
    )
}
