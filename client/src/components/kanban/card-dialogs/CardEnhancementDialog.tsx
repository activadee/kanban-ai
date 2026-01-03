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
import {Checkbox} from '@/components/ui/checkbox'
import {Label} from '@/components/ui/label'
import {Sparkles} from 'lucide-react'
import {useGithubAuthStatus} from '@/hooks/github'
import {useProjectGithubOrigin, useProjectSettings} from '@/hooks/projects'

type TicketSnapshot = {
    title: string
    description?: string | null
}

type CardEnhancementDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    current: TicketSnapshot
    enhanced: TicketSnapshot
    projectId: string
    onAccept: (createGithubIssue?: boolean) => Promise<void> | void
    onReject: () => Promise<void> | void
}

export function CardEnhancementDialog({
                                          open,
                                          onOpenChange,
                                          current,
                                          enhanced,
                                          projectId,
                                          onAccept,
                                          onReject,
                                      }: CardEnhancementDialogProps) {
    const [pending, setPending] = useState(false)
    const [createGithubIssue, setCreateGithubIssue] = useState(false)

    const githubCheckQuery = useGithubAuthStatus({enabled: open})
    const originQuery = useProjectGithubOrigin(projectId, {enabled: open && Boolean(projectId)})
    const settingsQuery = useProjectSettings(projectId, {enabled: open && Boolean(projectId)})

    const hasGithubConnection = githubCheckQuery.data?.status === 'valid'
    const origin = originQuery.data
    const hasOrigin = Boolean(origin?.owner && origin?.repo)
    const autoCreateEnabled = Boolean(settingsQuery.data?.githubIssueAutoCreateEnabled)
    const canCreateGithubIssue = autoCreateEnabled && hasGithubConnection && hasOrigin

    const handleAccept = async () => {
        if (pending) return
        setPending(true)
        try {
            await onAccept(createGithubIssue && canCreateGithubIssue ? true : undefined)
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
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-tight text-primary">
                        <Sparkles className="size-3" />
                        AI suggestion ready
                    </div>
                    <DialogTitle>Review AI enhancement</DialogTitle>
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
                <div className="mt-4 space-y-2">
                    <div className="flex items-start gap-3">
                        <Checkbox
                            id="create-github-issue-enhancement"
                            checked={createGithubIssue}
                            disabled={!canCreateGithubIssue || pending}
                            onCheckedChange={(checked) => setCreateGithubIssue(checked === true)}
                        />
                        <div className="space-y-1">
                            <Label htmlFor="create-github-issue-enhancement">Create GitHub Issue</Label>
                            <p className="text-xs text-muted-foreground">
                                {origin?.owner && origin?.repo
                                    ? `Creates an issue in ${origin.owner}/${origin.repo} when accepting this enhancement.`
                                    : 'Creates an issue in the project\'s GitHub repository when accepting this enhancement.'}
                            </p>
                            {!canCreateGithubIssue ? (
                                <p className="text-xs text-muted-foreground">
                                    Enable GitHub Issue Creation in project settings and ensure GitHub is connected.
                                </p>
                            ) : null}
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
                        {pending && createGithubIssue ? 'Creating GitHub issue…' : 'Accept'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
