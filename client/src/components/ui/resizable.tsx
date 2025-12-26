import * as React from "react"
import {GripVerticalIcon} from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import {cn} from "@/lib/utils"

type Direction = "horizontal" | "vertical"

type StorageLike = Pick<Storage, "getItem" | "setItem">

function useSafeStorage(): StorageLike {
    const memoryStore = React.useRef(new Map<string, string>())

    return React.useMemo(() => {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage
        }

        return {
            getItem: (key: string) => memoryStore.current.get(key) ?? null,
            setItem: (key: string, value: string) => {
                memoryStore.current.set(key, value)
            },
        }
    }, [])
}

type ResizablePanelGroupProps = Omit<
    React.ComponentProps<typeof ResizablePrimitive.Group>,
    "defaultLayout" | "onLayoutChange" | "orientation"
> & {
    direction?: Direction
    autoSaveId?: string
}

function ResizablePanelGroup({
    className,
    direction = "horizontal",
    autoSaveId,
    ...props
}: ResizablePanelGroupProps) {
    const storage = useSafeStorage()

    const persistedLayout = ResizablePrimitive.useDefaultLayout({
        id: autoSaveId ?? "resizable-panel-group",
        storage,
    })

    return (
        <ResizablePrimitive.Group
            data-slot="resizable-panel-group"
            data-panel-group-direction={direction}
            className={cn(
                "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
                className
            )}
            orientation={direction}
            defaultLayout={autoSaveId ? persistedLayout.defaultLayout : undefined}
            onLayoutChange={autoSaveId ? persistedLayout.onLayoutChange : undefined}
            {...props}
        />
    )
}

function ResizablePanel({
    ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
    return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

type ResizableHandleProps = React.ComponentProps<typeof ResizablePrimitive.Separator> & {
    withHandle?: boolean
    direction?: Direction
}

function ResizableHandle({
    withHandle,
    direction = "horizontal",
    className,
    ...props
}: ResizableHandleProps) {
    return (
        <ResizablePrimitive.Separator
            data-slot="resizable-handle"
            data-panel-group-direction={direction}
            className={cn(
                "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
                className
            )}
            {...props}
        >
            {withHandle && (
                <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
                    <GripVerticalIcon className="size-2.5"/>
                </div>
            )}
        </ResizablePrimitive.Separator>
    )
}

export {ResizablePanelGroup, ResizablePanel, ResizableHandle}
