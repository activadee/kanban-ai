import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {toast} from '@/components/ui/toast'
import {useMergeAttemptBase} from '@/hooks'

export function MergeBaseDialog({attemptId, open, onOpenChange}: {
    attemptId: string;
    open: boolean;
    onOpenChange: (v: boolean) => void
}) {
    const mergeMut = useMergeAttemptBase({
        onSuccess: () => {
            toast({title: 'Merged', description: 'Base branch merged into your branch.', variant: 'success'})
            onOpenChange(false)
        },
        onError: (err) => {
            toast({title: 'Merge failed', description: err.message, variant: 'destructive'})
        },
    })
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Merge</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">This merges your attempt branch into the project’s base
                    branch (no push). The task moves to Done and we now clean up its worktree and branch automatically.
                    manually.</p>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => mergeMut.mutate({attemptId})}
                            disabled={mergeMut.isPending}>{mergeMut.isPending ? 'Merging…' : 'Merge'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
