import type {AttemptLog} from 'shared'

export function LogsPane({logs}: { logs: AttemptLog[] }) {
    return (
        <div className="flex-1 min-h-0 overflow-auto rounded bg-muted/10 p-2 font-mono text-xs">
            {logs.length === 0 ? (
                <div className="text-muted-foreground">No logs yet…</div>
            ) : (
                logs.map((l) => (
                    <div key={l.id}
                         className="whitespace-pre-wrap">[{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.message}</div>
                ))
            )}
        </div>
    )
}

