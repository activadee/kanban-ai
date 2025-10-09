import {useState} from 'react'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {toast} from '@/components/ui/toast'
import {useCreateAttemptPR} from '@/hooks'

export function CreatePrDialog({attemptId, baseBranch, defaultTitle, defaultBody, open, onOpenChange}: {
    attemptId: string;
    baseBranch?: string;
    defaultTitle?: string;
    defaultBody?: string;
    open: boolean;
    onOpenChange: (v: boolean) => void
}) {
    const [title, setTitle] = useState(defaultTitle || '')
    const [body, setBody] = useState(defaultBody || '')

    const prMut = useCreateAttemptPR({
        onSuccess: (pr) => {
            toast({title: 'Pull request created', description: `#${pr.number} — ${pr.url}`, variant: 'success'})
            onOpenChange(false)
            setBody('')
        },
        onError: (err) => {
            toast({title: 'PR failed', description: err.message, variant: 'destructive'})
        },
    })

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
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={() => prMut.mutate({
                            attemptId,
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
