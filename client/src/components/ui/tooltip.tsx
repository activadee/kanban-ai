import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({className, side = 'top', align = 'center', sideOffset = 8, ...props}, ref) => (
    <TooltipPrimitive.Content
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={[
            'z-50 overflow-hidden rounded-md border border-border/60 bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm',
            className || '',
        ].join(' ')}
        {...props}
    />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName
