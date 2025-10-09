import {useState} from 'react'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Checkbox} from '@/components/ui/checkbox'
import {Button} from '@/components/ui/button'
import {toast} from '@/components/ui/toast'
import {useCommitAttempt} from '@/hooks'

export function CommitDialog({attemptId, open, onOpenChange}: {
    attemptId: string;
    open: boolean;
    onOpenChange: (v: boolean) => void
}) {
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [pushAfter, setPushAfter] = useState(true)

    const commitMut = useCommitAttempt({
        onSuccess: ({shortSha}, variables) => {
            const pushed = variables?.pushAfter ?? pushAfter
            toast({
                title: 'Committed',
                description: `Created ${shortSha}${pushed ? ' and pushed' : ''}`,
                variant: 'success'
            })
            onOpenChange(false)
            setSubject('')
            setBody('')
        },
        onError: (err) => {
            toast({title: 'Commit failed', description: err.message, variant: 'destructive'})
        },
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Commit</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input value={subject} onChange={(e) => setSubject(e.target.value)}
                               placeholder="feat: implement X"/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Message</label>
                        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional body"
                                  rows={5}/>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox id="push-after" checked={pushAfter}
                                  onCheckedChange={(v) => setPushAfter(v === true)}/>
                        <label htmlFor="push-after" className="text-sm">Push after commit</label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={() => commitMut.mutate({
                            attemptId,
                            subject: subject.trim(),
                            body: body.trim() || undefined,
                            pushAfter,
                        })}
                        disabled={!subject.trim() || commitMut.isPending}
                    >
                        {commitMut.isPending ? 'Committing…' : 'Commit'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
