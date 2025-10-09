import {useEffect, useState} from 'react'
import {Drawer, DrawerContent} from '@/components/ui/drawer'
import {ProjectSettingsPanel} from '@/components/projects/ProjectSettingsPanel'

export function ProjectSettingsDrawer({projectId, open, onOpenChange}: {
    projectId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void
}) {
    const [currentId, setCurrentId] = useState<string | null>(projectId)

    useEffect(() => {
        if (open) setCurrentId(projectId)
    }, [projectId, open])

    return (
        <Drawer open={open} onOpenChange={onOpenChange} direction="right">
            <DrawerContent
                className="data-[vaul-drawer-direction=right]:w-[92vw] data-[vaul-drawer-direction=right]:sm:max-w-xl data-[vaul-drawer-direction=right]:md:max-w-2xl">
                {currentId ? (
                    <div className="flex h-[80vh] flex-col">
                        <ProjectSettingsPanel projectId={currentId} onClose={() => onOpenChange(false)} scrollArea/>
                    </div>
                ) : null}
            </DrawerContent>
        </Drawer>
    )
}
