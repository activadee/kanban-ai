import {useEffect, useRef, useState} from 'react'
import {Bot, Loader2} from 'lucide-react'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {toast} from '@/components/ui/toast'
import {useCreatePullRequest, useProjectPullRequests, useSummarizePullRequest} from '@/hooks'
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
    const [summarizing, setSummarizing] = useState(false)
    const [summaryOriginal, setSummaryOriginal] = useState<{title: string; body: string} | null>(null)
    const [summarySuggestion, setSummarySuggestion] = useState<{title: string; body: string} | null>(null)

    const wasOpen = useRef(open)

    useEffect(() => {
        if (open && !wasOpen.current) {
            setTitle(defaultTitle || '')
            setBody(defaultBody || '')
            setSummarizing(false)
            setSummaryOriginal(null)
            setSummarySuggestion(null)
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

    const prSummaryMutation = useSummarizePullRequest()

    const handleSummarizePr = () => {
        if (summarizing) return

        const headBranch = branch?.trim()
        if (!headBranch) return

        const original = {
            title: (title || defaultTitle || '').trim(),
            body: body || defaultBody || '',
        }

        setSummarizing(true)
        setSummaryOriginal(original)
        setSummarySuggestion(null)

        prSummaryMutation.mutate(
            {
                projectId,
                branch: headBranch,
                base: baseBranch,
            },
            {
                onSuccess: (summary) => {
                    setSummarySuggestion(summary)
                    setSummarizing(false)
                },
                onError: (err) => {
                    console.error('PR summary failed', err)
                    const {title: errTitle, description, status} = describeApiError(
                        err,
                        'Failed to summarize pull request',
                    )
                    const desc =
                        status === 401
                            ? description ??
                              'Connect GitHub and configure an inline agent before summarizing PRs.'
                            : description
                    toast({
                        title: errTitle,
                        description: desc,
                        variant: status === 401 ? 'default' : 'destructive',
                    })
                    setSummarizing(false)
                    setSummaryOriginal(null)
                    setSummarySuggestion(null)
                },
            },
        )
    }

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
                        <div className="relative">
                            <Textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Optional body"
                                rows={5}
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="absolute bottom-2 right-2 h-7 w-7 rounded-full"
                                disabled={summarizing || !branch}
                                onClick={handleSummarizePr}
                                aria-label="Summarize PR"
                            >
                                {summarizing ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Bot className="size-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                    {summaryOriginal && summarySuggestion ? (
                        <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-sm">
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    AI suggestion preview
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSummaryOriginal(null)
                                            setSummarySuggestion(null)
                                        }}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setTitle(summarySuggestion.title)
                                            setBody(summarySuggestion.body)
                                            setSummaryOriginal(null)
                                            setSummarySuggestion(null)
                                        }}
                                    >
                                        Accept
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-muted-foreground">
                                        Original
                                    </div>
                                    <div className="text-sm font-medium break-words">
                                        {summaryOriginal.title}
                                    </div>
                                    <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                                        {summaryOriginal.body || 'No description'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                                        Suggestion
                                    </div>
                                    <div className="text-sm font-medium break-words">
                                        {summarySuggestion.title}
                                    </div>
                                    <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                                        {summarySuggestion.body || 'No description'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
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
