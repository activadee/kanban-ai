import type {Attempt, Card as TCard} from 'shared'
import {AttemptChangesDialog} from '@/components/git/AttemptChangesDialog'
import {CommitDialog} from '@/components/git/CommitDialog'
import {CreatePrDialog} from '@/components/git/CreatePrDialog'
import {MergeBaseDialog} from '@/components/git/MergeBaseDialog'
import {AttemptToolbar} from '../AttemptToolbar'

export type GitSectionProps = {
    projectId: string
    card: TCard
    attempt: Attempt | null
    openButtonDisabledReason: string | null
    onOpenEditor: () => void
    changesOpen: boolean
    onChangesOpenChange: (open: boolean) => void
    commitOpen: boolean
    onCommitOpenChange: (open: boolean) => void
    prOpen: boolean
    onPrOpenChange: (open: boolean) => void
    mergeOpen: boolean
    onMergeOpenChange: (open: boolean) => void
    prDefaults: { title: string; body: string }
}

export function GitSection({
                               projectId,
                               card,
                               attempt,
                               openButtonDisabledReason,
                               onOpenEditor,
                               changesOpen,
                               onChangesOpenChange,
                               commitOpen,
                               onCommitOpenChange,
                               prOpen,
                               onPrOpenChange,
                               mergeOpen,
                               onMergeOpenChange,
                               prDefaults,
                           }: GitSectionProps) {
    return (
        <>
            <AttemptToolbar
                attempt={attempt}
                openButtonDisabledReason={openButtonDisabledReason}
                onOpenEditor={onOpenEditor}
                onOpenChanges={() => onChangesOpenChange(true)}
                onOpenCommit={() => onCommitOpenChange(true)}
                onOpenPr={() => onPrOpenChange(true)}
                onOpenMerge={() => onMergeOpenChange(true)}
            />
            <AttemptChangesDialog
                attemptId={attempt?.id ?? ''}
                open={changesOpen && Boolean(attempt?.id)}
                onOpenChange={onChangesOpenChange}
                title={`Changes — ${card.title}`}
            />
            <CommitDialog
                attemptId={attempt?.id ?? ''}
                open={commitOpen && Boolean(attempt?.id)}
                onOpenChange={onCommitOpenChange}
            />
            <CreatePrDialog
                projectId={projectId}
                attemptId={attempt?.id}
                cardId={card.id}
                branch={attempt?.branchName}
                baseBranch={attempt?.baseBranch}
                defaultTitle={prDefaults.title}
                defaultBody={prDefaults.body}
                open={prOpen && Boolean(attempt?.id)}
                onOpenChange={onPrOpenChange}
            />
            <MergeBaseDialog
                attemptId={attempt?.id ?? ''}
                open={mergeOpen && Boolean(attempt?.id)}
                onOpenChange={onMergeOpenChange}
            />
        </>
    )
}

