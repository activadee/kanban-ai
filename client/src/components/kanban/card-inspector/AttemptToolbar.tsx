import {Button} from '@/components/ui/button'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {Code2} from 'lucide-react'
import type {Attempt} from 'shared'

export function AttemptToolbar({
                                   attempt,
                                   openButtonDisabledReason,
                                   onOpenEditor,
                                   onOpenChanges,
                                   onOpenCommit,
                                   onOpenPr,
                                   onOpenMerge,
                               }: {
    attempt: Attempt | null
    openButtonDisabledReason: string | null
    onOpenEditor: () => void
    onOpenChanges: () => void
    onOpenCommit: () => void
    onOpenPr: () => void
    onOpenMerge: () => void
}) {
    if (!attempt) return null
    return (
        <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onOpenEditor} disabled={!!openButtonDisabledReason}
                    title={openButtonDisabledReason ?? undefined}>
                <Code2 className="mr-2 size-4"/> Open editor
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">Git…</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                    <DropdownMenuItem onClick={onOpenChanges}>View Changes</DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenCommit}>Commit…</DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenPr}>Create PR…</DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenMerge}>Merge</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

