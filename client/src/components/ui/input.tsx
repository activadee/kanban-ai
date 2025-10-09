import * as React from "react"
import {cn} from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(({className, type = 'text', ...props}, ref) => {
    return (
        <input
            type={type}
            className={cn(
                "flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs transition-colors",
                "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            ref={ref}
            {...props}
        />
    )
})
Input.displayName = "Input"

export {Input}
