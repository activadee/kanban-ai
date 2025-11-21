import * as React from "react"
import {cn} from "@/lib/utils"

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
    orientation?: 'horizontal' | 'vertical'
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
    ({className, orientation = 'horizontal', ...props}, ref) => {
        const isVertical = orientation === 'vertical'
        return (
            <div
                ref={ref}
                role="separator"
                aria-orientation={orientation}
                className={cn(
                    "shrink-0 bg-border",
                    isVertical ? "w-px h-full" : "h-px w-full",
                    className,
                )}
                {...props}
            />
        )
    }
)
Separator.displayName = "Separator"

export {Separator}
