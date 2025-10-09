import {useState, useEffect, useMemo} from 'react'
import {useAttempt, useAttemptGitStatus, useAttemptFileContent} from '@/hooks'
import type {FileChange, GitFileStatus} from 'shared'
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog'
import {ScrollArea} from '@/components/ui/scroll-area'
import {DiffPanel} from '@/components/diff/DiffPanel'
import {Badge} from '@/components/ui/badge'

function StatusBadge({status}: { status: GitFileStatus }) {
    const effective = status === '?' ? 'A' : status === 'U' ? 'M' : status
    const map: Record<string, string> = {
        A: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
        M: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20',
        D: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20',
        R: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20',
        C: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20',
    }
    const cls = map[effective] || 'bg-muted text-foreground'
    return <span
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-medium ${cls}`}>{effective}</span>
}

// (reserved) grouping helper if sections are needed later

function FileRow({file, selected, onSelect}: {
    file: FileChange
    selected: boolean
    onSelect: (file: FileChange) => void
}) {
    return (
        <div
            className={`flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/60 cursor-pointer ${selected ? 'bg-muted' : ''}`}
            onClick={() => onSelect(file)}>
            <StatusBadge status={file.status as GitFileStatus}/>
            <span className="truncate">{file.path}</span>
        </div>
    )
}

export function AttemptChangesDialog({attemptId, open, onOpenChange, title}: {
    attemptId: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title?: string
}) {
    const statusQuery = useAttemptGitStatus(attemptId, {enabled: open})
    const attemptQuery = useAttempt(attemptId, {enabled: open && Boolean(attemptId)})
    const [selected, setSelected] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (open) setSelected(undefined)
    }, [open])

    useEffect(() => {
        if (statusQuery.isSuccess && !selected) {
            const first = statusQuery.data.files[0]?.path
            if (first) setSelected(first)
        }
    }, [selected, statusQuery.data?.files, statusQuery.isSuccess])

    const fileStatus: GitFileStatus | undefined = useMemo(() => {
        const s = statusQuery.data?.files.find((f) => f.path === selected)?.status
        return s as GitFileStatus | undefined
    }, [statusQuery.data, selected])


    const baseQuery = useAttemptFileContent(attemptId, selected, 'base', {enabled: Boolean(open && selected)})
    const rightQuery = useAttemptFileContent(attemptId, selected, 'worktree', {enabled: Boolean(open && selected)})

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton
                className="w-[96vw] max-w-[96vw] md:max-w-[94vw] lg:max-w-[92vw] xl:max-w-[90vw] h-[92vh] p-0 rounded-lg overflow-hidden"
            >
                <div className="border-b p-3"><DialogTitle>{title ?? 'Changes'}</DialogTitle></div>
                <div className="flex h-[calc(92vh-48px)] min-h-0">
                    {statusQuery.isSuccess ? (
                        <div className="flex h-full w-80 flex-col border-r bg-background">
                            <div className="border-b p-2 text-sm font-medium">Changes</div>
                            <div className="px-2 pb-2 text-xs text-muted-foreground">Comparing to
                                base: {attemptQuery.data?.baseBranch ?
                                    <Badge variant="outline">{attemptQuery.data.baseBranch}</Badge> :
                                    <Badge variant="outline">HEAD</Badge>}</div>
                            <ScrollArea className="flex-1 p-2">
                                {statusQuery.data.files.length ? (
                                    <div className="space-y-1">
                                        {statusQuery.data.files.map((f) => (
                                            <FileRow key={f.path} file={f} selected={selected === f.path}
                                                     onSelect={(file) => setSelected(file.path)}/>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No changes.</div>
                                )}
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="w-80 border-r p-2 text-sm text-muted-foreground">Loading…</div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between border-b p-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                {fileStatus ? <StatusBadge status={fileStatus}/> : null}
                                <div className="truncate font-medium">{selected ?? 'No file selected'}</div>
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            {baseQuery.isLoading || rightQuery.isLoading ? (
                                <div className="p-4 text-sm text-muted-foreground">Loading diff…</div>
                            ) : selected ? (
                                <div className="p-2">
                                    <DiffPanel filePath={selected} baseContent={baseQuery.data ?? ''}
                                               rightContent={rightQuery.data ?? ''} showOnly={true}/>
                                </div>
                            ) : (
                                <div className="p-4 text-sm text-muted-foreground">Select a file to view diff.</div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default AttemptChangesDialog
