import * as React from "react"
import {GripVerticalIcon} from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import {cn} from "@/lib/utils"

type Direction = "horizontal" | "vertical"

const RESIZABLE_PANELS_STORAGE_KEY_PREFIX = "react-resizable-panels:"

const FORBIDDEN_LAYOUT_KEYS = new Set(["__proto__", "prototype", "constructor"])

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function isValidLayoutSize(size: number) {
    return Number.isFinite(size) && size >= 0 && size <= 100
}

export function sanitizeResizablePanelsLayoutString(key: string, value: string | null) {
    if (value === null) return null
    if (!key.startsWith(RESIZABLE_PANELS_STORAGE_KEY_PREFIX)) return value

    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        return null
    }

    if (!isObjectRecord(parsed)) return null

    const nestedLayout = parsed["layout"]
    const layoutCandidate = isObjectRecord(nestedLayout) ? nestedLayout : parsed
    const shouldReserialize = layoutCandidate !== parsed

    let didCoerce = false
    const coercedLayout: Record<string, number> = Object.create(null)
    let entryCount = 0

    for (const [panelId, rawSize] of Object.entries(layoutCandidate)) {
        if (FORBIDDEN_LAYOUT_KEYS.has(panelId)) return null
        entryCount++

        if (typeof rawSize === "number") {
            if (!isValidLayoutSize(rawSize)) return null
            coercedLayout[panelId] = rawSize
        } else if (typeof rawSize === "string") {
            const trimmed = rawSize.trim()
            if (trimmed === "") return null

            const coerced = Number(trimmed)
            if (!isValidLayoutSize(coerced)) return null

            coercedLayout[panelId] = coerced
            didCoerce = true
        } else {
            return null
        }
    }

    if (entryCount === 0) return null

    return didCoerce || shouldReserialize ? JSON.stringify(coercedLayout) : value
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

function useSafeStorage(): StorageLike {
    const memoryStore = React.useRef(new Map<string, string>())

    return React.useMemo(() => {
        const memoryStorage: StorageLike = {
            getItem: (key: string) => memoryStore.current.get(key) ?? null,
            setItem: (key: string, value: string) => {
                memoryStore.current.set(key, value)
            },
        }

        const localStorageBacking: StorageLike | null = (() => {
            try {
                if (typeof window === "undefined") return null
                const localStorage = window.localStorage

                return {
                    getItem: (key: string) => {
                        try {
                            return localStorage.getItem(key)
                        } catch {
                            return memoryStorage.getItem(key)
                        }
                    },
                    setItem: (key: string, value: string) => {
                        try {
                            localStorage.setItem(key, value)
                        } catch {
                            memoryStorage.setItem(key, value)
                        }
                    },
                }
            } catch {
                return null
            }
        })()

        const backingStorage = localStorageBacking ?? memoryStorage

        return {
            getItem: (key: string) => {
                const rawValue = backingStorage.getItem(key)
                return sanitizeResizablePanelsLayoutString(key, rawValue)
            },
            setItem: (key: string, value: string) => {
                backingStorage.setItem(key, value)
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

    React.useEffect(() => {
        if (!autoSaveId) return
        if (typeof window === "undefined") return

        const storageKey = `${RESIZABLE_PANELS_STORAGE_KEY_PREFIX}${autoSaveId}`

        try {
            const localStorage = window.localStorage
            const rawValue = localStorage.getItem(storageKey)

            if (rawValue === null) return

            const sanitized = sanitizeResizablePanelsLayoutString(storageKey, rawValue)

            if (sanitized === null) {
                localStorage.removeItem(storageKey)
                return
            }

            if (sanitized !== rawValue) {
                localStorage.setItem(storageKey, sanitized)
            }
        } catch {
            return
        }
    }, [autoSaveId])

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
