import {useEffect, useState} from 'react'
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {ProjectSettingsPanel} from '@/components/projects/ProjectSettingsPanel'

export function ProjectSettingsDialog({projectId, open, onOpenChange}: {
    projectId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void
}) {
    const [currentId, setCurrentId] = useState<string | null>(projectId)

    useEffect(() => {
        if (open) {
            setCurrentId(projectId)
        }
    }, [projectId, open])

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) setCurrentId(null)
                onOpenChange(next)
            }}
        >
            <DialogContent className="max-w-4xl p-0" scrollable={false}>
                <DialogHeader className="px-6 pt-4">
                    <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
                {currentId ? (
                    <div className="h-[70vh]">
                        <ProjectSettingsPanel projectId={currentId} onClose={() => onOpenChange(false)} scrollArea/>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
