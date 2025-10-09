import {Button} from '@/components/ui/button'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'

export type DependencyCard = { id: string; title: string; ticketKey?: string }

export function DependenciesPicker({
                                       availableCards,
                                       value,
                                       onChange,
                                       triggerLabel = 'Edit dependencies',
                                       hint,
                                       disabled,
                                       widthClass = 'max-h-72 w-96',
                                   }: {
    availableCards: DependencyCard[]
    value: string[]
    onChange: (ids: string[]) => void
    triggerLabel?: string
    hint?: string
    disabled?: boolean
    widthClass?: string
}) {
    const toggle = (id: string, nextChecked: boolean) => {
        const current = new Set(value ?? [])
        if (nextChecked) current.add(id)
        else current.delete(id)
        onChange(Array.from(current))
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled}>{triggerLabel}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={`${widthClass} overflow-auto p-0`}>
                {hint ? <div className="p-2 text-xs text-muted-foreground">{hint}</div> : null}
                <div className="max-h-64 overflow-auto py-1">
                    {availableCards.length === 0 ? (
                        <div className="px-2 py-1 text-sm text-muted-foreground">No tickets available</div>
                    ) : (
                        availableCards.map((c) => {
                            const id = c.id
                            const checked = (value ?? []).includes(id)
                            const label = `${c.ticketKey ? `[${c.ticketKey}] ` : ''}${c.title}`
                            return (
                                <DropdownMenuItem key={id} onSelect={(e) => e.preventDefault()} className="gap-2">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => toggle(id, e.target.checked)}
                                    />
                                    <span className="truncate text-sm">{label}</span>
                                </DropdownMenuItem>
                            )
                        })
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

