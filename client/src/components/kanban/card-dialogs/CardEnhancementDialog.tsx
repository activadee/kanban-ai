import {useState} from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'

type TicketSnapshot = {
    title: string
    description?: string | null
}

type CardEnhancementDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    current: TicketSnapshot
    enhanced: TicketSnapshot
    onAccept: () => Promise<void> | void
    onReject: () => Promise<void> | void
}

export function CardEnhancementDialog({
                                          open,
                                          onOpenChange,
                                          current,
                                          enhanced,
                                          onAccept,
                                          onReject,
                                      }: CardEnhancementDialogProps) {
    const [pending, setPending] = useState(false)

    const handleAccept = async () => {
        if (pending) return
        setPending(true)
        try {
            await onAccept()
        } finally {
            setPending(false)
        }
    }

    const handleReject = async () => {
        if (pending) return
        setPending(true)
        try {
            await onReject()
        } finally {
            setPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Review enhancement</DialogTitle>
                    <DialogDescription>
                        Compare the current ticket with the AI-enhanced suggestion, then accept or reject the changes.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">Current ticket</div>
                        <div className="break-words text-sm font-medium">{current.title}</div>
                        <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                            {current.description || 'No description'}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            Enhanced suggestion
                        </div>
                        <div className="break-words text-sm font-medium">{enhanced.title}</div>
                        <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                            {enhanced.description || 'No description'}
                        </div>
                    </div>
                </div>
                <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={pending}
                    >
                        Close
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleReject}
                        disabled={pending}
                    >
                        Reject
                    </Button>
                    <Button
                        type="button"
                        onClick={handleAccept}
                        disabled={pending}
                    >
                        Accept
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

