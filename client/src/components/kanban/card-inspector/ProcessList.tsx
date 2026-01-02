import type {ProcessEntry} from './types'
import {ProcessRow} from './ProcessRow'

export function ProcessList({entries}: {entries: ProcessEntry[]}) {
    return (
        <div className="flex-1 min-h-0 overflow-auto space-y-3 p-1">
            {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-muted-foreground">No processes yet...</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Processes will appear here when the agent runs</p>
                </div>
            ) : (
                entries.map((entry) => (
                    <ProcessRow key={entry.id} entry={entry} />
                ))
            )}
        </div>
    )
}
