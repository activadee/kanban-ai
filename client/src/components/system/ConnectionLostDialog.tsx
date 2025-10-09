import {Loader2} from 'lucide-react'
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog'

type ConnectionLostDialogProps = {
    open: boolean
}

export function ConnectionLostDialog({open}: ConnectionLostDialogProps) {
    return (
        <Dialog open={open} onOpenChange={() => {
        }}>
            <DialogContent showCloseButton={false} className="sm:max-w-sm">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true"/>
                    <DialogHeader className="gap-1 text-center">
                        <DialogTitle>Reconnecting to Kanban</DialogTitle>
                        <DialogDescription>
                            We lost the realtime link to the board. Hang tight, reconnecting now. This will clear once
                            the connection is healthy again.
                        </DialogDescription>
                    </DialogHeader>
                </div>
            </DialogContent>
        </Dialog>
    )
}
