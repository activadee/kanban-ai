import {useEffect, useState} from 'react'
import {useGithubAuthStatus, useProjectGithubOrigin, useImportGithubIssues} from '@/hooks'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import type {ImportIssuesRequest, ImportIssuesResponse} from 'shared'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'

export function ImportIssuesDialog({
                                       projectId,
                                       open,
                                       onOpenChange,
                                       onImported,
                                       defaultRepo,
                                   }: {
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onImported?: (result: ImportIssuesResponse) => void
    defaultRepo?: string | null
}) {
    const [repo, setRepo] = useState(defaultRepo ?? '')
    type IssueState = 'open' | 'closed' | 'all'
    const [state, setState] = useState<IssueState>('open')
    const [error, setError] = useState<string | null>(null)
    const githubCheckQuery = useGithubAuthStatus({enabled: open})

    const githubOriginQuery = useProjectGithubOrigin(projectId, {enabled: open})

    const ghOk = githubCheckQuery.data?.status === 'valid'

    useEffect(() => {
        if (open && defaultRepo) setRepo(defaultRepo)
    }, [open, defaultRepo])

    useEffect(() => {
        if (!githubOriginQuery.data) return
        if (githubOriginQuery.data.owner && githubOriginQuery.data.repo && !repo.trim()) {
            setRepo(`${githubOriginQuery.data.owner}/${githubOriginQuery.data.repo}`)
        }
    }, [githubOriginQuery.data, repo])

    const importMutation = useImportGithubIssues({
        onSuccess: (result) => {
            onImported?.(result)
            onOpenChange(false)
        },
        onError: (err: unknown) => {
            console.error('Import failed', err)
            setError(err instanceof Error ? err.message : 'Import failed')
        },
    })

    const submit = async () => {
        setError(null)
        try {
            const [owner, name] = repo.split('/')
            if (!owner || !name) throw new Error('Enter repo as "owner/name"')
            const payload: ImportIssuesRequest = {owner, repo: name, state}
            await importMutation.mutateAsync({projectId, payload})
        } catch (err) {
            console.error('Import failed', err)
            setError(err instanceof Error ? err.message : 'Import failed')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import GitHub Issues</DialogTitle>
                    <DialogDescription>
                        Import issues into this board. New issues go to Backlog. Existing mapped issues are updated.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Repository</Label>
                        <Input placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)}/>
                        {!ghOk && (
                            <p className="text-xs text-muted-foreground">GitHub not connected. Use the sidebar to
                                connect.</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>States</Label>
                        <Select value={state} onValueChange={(v) => setState(v as IssueState)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Open"/>
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>

                <DialogFooter>
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}
                                disabled={importMutation.isPending}>Cancel</Button>
                        <Button onClick={submit} disabled={!repo || !ghOk || importMutation.isPending}>
                            {importMutation.isPending ? 'Importing…' : 'Import'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
