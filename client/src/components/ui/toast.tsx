import {useEffect, useState} from 'react'

type Toast = { id: string; title?: string; description?: string; variant?: 'default' | 'success' | 'destructive' }

const listeners = new Set<(t: Toast) => void>()

// eslint-disable-next-line react-refresh/only-export-components
export function toast(t: Omit<Toast, 'id'>) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const payload: Toast = {id, ...t}
    listeners.forEach((fn) => fn(payload))
}

export function Toaster() {
    const [items, setItems] = useState<Toast[]>([])
    useEffect(() => {
        const onToast = (t: Toast) => {
            setItems((prev) => [...prev, t])
            setTimeout(() => {
                setItems((prev) => prev.filter((x) => x.id !== t.id))
            }, 4000)
        }
        listeners.add(onToast)
        return () => {
            listeners.delete(onToast)
        }
    }, [])
    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-center p-4">
            <div className="flex w-full max-w-sm flex-col gap-2">
                {items.map((t) => (
                    <div key={t.id} className={`pointer-events-auto rounded-md border p-3 shadow-sm ${
                        t.variant === 'destructive' ? 'border-destructive/40 bg-destructive/10 text-destructive' : t.variant === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-border/60 bg-background'
                    }`}>
                        {t.title ? <div className="text-sm font-medium">{t.title}</div> : null}
                        {t.description ? <div className="text-xs opacity-80">{t.description}</div> : null}
                    </div>
                ))}
            </div>
        </div>
    )
}
