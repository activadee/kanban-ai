import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import type {ProjectSummary} from 'shared'

type ProjectDeleteDialogProps = {
    open: boolean
    project: ProjectSummary | null
    loading?: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<void> | void
    errorMessage?: string | null
}

export function ProjectDeleteDialog({
                                        open,
                                        project,
                                        loading = false,
                                        onOpenChange,
                                        onConfirm,
                                        errorMessage
                                    }: ProjectDeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete project</DialogTitle>
                    <DialogDescription>
                        {project ? (
                            <>
                                This will remove <span className="font-medium">{project.name}</span> and all of its
                                tickets. This action cannot be
                                undone.
                            </>
                        ) : (
                            'This will remove the selected project and all of its tickets. This action cannot be undone.'
                        )}
                    </DialogDescription>
                </DialogHeader>
                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Deleting…' : 'Delete project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
