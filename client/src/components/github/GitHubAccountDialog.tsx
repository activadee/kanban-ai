import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'

export function GitHubAccountDialog({
                                        open,
                                        onOpenChange,
                                        username,
                                        primaryEmail,
                                        onDisconnect,
                                        disconnecting = false,
                                    }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    username?: string | null
    primaryEmail?: string | null
    onDisconnect: () => void
    disconnecting?: boolean
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>GitHub Account</DialogTitle>
                    <DialogDescription>Manage your GitHub connection for KanbanAI.</DialogDescription>
                </DialogHeader>
                <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Username:</span> <span
                        className="font-medium">{username ?? '—'}</span></div>
                    <div><span className="text-muted-foreground">Primary email:</span> <span
                        className="font-medium">{primaryEmail ?? '—'}</span></div>
                </div>
                <DialogFooter>
                    <Button variant="destructive" onClick={onDisconnect} disabled={disconnecting}>
                        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
