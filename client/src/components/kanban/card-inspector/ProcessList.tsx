import type {ProcessEntry} from './types'
import {ProcessRow} from './ProcessRow'

export function ProcessList({entries}: { entries: ProcessEntry[] }) {
    return (
        <div className="flex-1 min-h-0 overflow-auto rounded bg-muted/10 p-3">
            {entries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No processes yet…</div>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => (
                        <ProcessRow key={entry.id} entry={entry}/>
                    ))}
                </div>
            )}
        </div>
    )
}

