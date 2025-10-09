import {AlertCircle, Loader2, Search, FolderGit} from 'lucide-react'
import {Button} from '@/components/ui/button'

export type RepoEntry = { name: string; path: string }

export function RepoList({
                             entries,
                             loading,
                             error,
                             onRefresh,
                             onManual,
                             onSelect,
                         }: {
    entries: RepoEntry[]
    loading: boolean
    error: string | null
    onRefresh: () => void
    onManual: () => void
    onSelect: (entry: RepoEntry) => void
}) {
    const empty = !loading && entries.length === 0 && !error
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={loading}
                            className="flex items-center gap-2">
                        {loading ? <Loader2 className="size-4 animate-spin"/> : null}
                        Refresh
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={onManual}>
                        Enter path manually
                    </Button>
                </div>
            </div>

            {error ? (
                <div
                    className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="size-4"/>
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-5 animate-spin"/>
                    Scanning for git repositories…
                </div>
            ) : null}

            {empty ? (
                <div
                    className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                    No repositories found yet. Try refreshing or paste a path manually.
                </div>
            ) : null}

            <div className="grid gap-3">
                {entries.map((entry) => (
                    <button
                        key={entry.path}
                        type="button"
                        onClick={() => onSelect(entry)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-background p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
            <span
                className="mt-0.5 inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FolderGit className="size-5"/>
            </span>
                        <span className="flex-1 space-y-1">
              <span className="block font-medium text-foreground">{entry.name}</span>
              <span className="block text-xs text-muted-foreground truncate">{entry.path}</span>
            </span>
                    </button>
                ))}
            </div>

            <button
                type="button"
                onClick={onManual}
                className="flex w-full items-start gap-3 rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
        <span
            className="mt-0.5 inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Search className="size-5"/>
        </span>
                <span className="flex-1 space-y-1">
          <span className="block font-medium text-foreground">Browse for repository</span>
          <span className="block text-xs text-muted-foreground">Paste or enter a path if it isn’t listed above</span>
        </span>
            </button>
        </div>
    )
}

