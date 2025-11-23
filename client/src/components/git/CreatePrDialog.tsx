import {useEffect, useRef, useState} from 'react'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {toast} from '@/components/ui/toast'
import {useCreatePullRequest, useProjectPullRequests} from '@/hooks'
import {describeApiError} from '@/api/http'

export function CreatePrDialog({
    projectId,
    attemptId,
    cardId,
    branch,
    baseBranch,
    defaultTitle,
    defaultBody,
    open,
    onOpenChange,
}: {
    projectId: string;
    attemptId?: string;
    cardId?: string;
    branch?: string;
    baseBranch?: string;
    defaultTitle?: string;
    defaultBody?: string;
    open: boolean;
    onOpenChange: (v: boolean) => void
}) {
    const [title, setTitle] = useState(defaultTitle || '')
    const [body, setBody] = useState(defaultBody || '')

    const wasOpen = useRef(open)

    useEffect(() => {
        if (open && !wasOpen.current) {
            setTitle(defaultTitle || '')
            setBody(defaultBody || '')
        }
        wasOpen.current = open
    }, [open, defaultTitle, defaultBody])

    const prListQuery = useProjectPullRequests(
        projectId,
        {branch, state: 'open'},
        {enabled: open && Boolean(projectId)},
    )

    const prMut = useCreatePullRequest({
        onSuccess: (pr) => {
            toast({title: 'Pull request created', description: `#${pr.number} — ${pr.url}`, variant: 'success'})
            void prListQuery.refetch()
            onOpenChange(false)
            setBody('')
        },
        onError: (err) => {
            const {title, description, status} = describeApiError(err, 'PR failed')
            const desc = status === 401 ? description ?? 'Connect GitHub before creating pull requests.' : description
            toast({title, description: desc, variant: status === 401 ? 'default' : 'destructive'})
        },
    })

    const branchLabel = branch ? branch : 'current branch'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create Pull Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)}
                               placeholder="feat: implement X"/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional body"
                                  rows={5}/>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                            <span>Existing PRs {branch ? `for ${branchLabel}` : ''}</span>
                            {prListQuery.isFetching ? <span className="text-[11px] font-normal">Refreshing…</span> : null}
                        </div>
                        {prListQuery.isLoading ? (
                            <div className="mt-2 text-xs text-muted-foreground">Loading pull requests…</div>
                        ) : prListQuery.isError ? (
                            <div className="mt-2 text-xs text-destructive">
                                {describeApiError(prListQuery.error, 'Failed to load PRs').status === 401
                                    ? 'Connect GitHub to view pull requests.'
                                    : 'Failed to load pull requests.'}
                            </div>
                        ) : prListQuery.data && prListQuery.data.length ? (
                            <ul className="mt-2 divide-y divide-border/60 rounded-md border border-border/50 bg-background/70">
                                {prListQuery.data.map((pr) => (
                                    <li key={pr.number} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                        <div className="space-y-0.5">
                                            <div className="font-medium">#{pr.number} {pr.title ?? ''}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {pr.headRef ? `${pr.headRef} → ${pr.baseRef ?? 'base'}` : pr.state}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" asChild>
                                            <a href={pr.url} target="_blank" rel="noreferrer">Open</a>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="mt-2 text-xs text-muted-foreground">No open pull requests{branch ? ' for this branch' : ''}.</div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={() => prMut.mutate({
                            projectId,
                            attemptId,
                            cardId,
                            branch,
                            base: baseBranch,
                            title: title.trim(),
                            body: body.trim() || undefined
                        })}
                        disabled={!title.trim() || prMut.isPending}
                    >
                        {prMut.isPending ? 'Creating…' : 'Create PR'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
