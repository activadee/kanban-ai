import {useState, useMemo} from 'react'
import {useParams} from 'react-router-dom'
import {
    GitBranch,
    RefreshCw,
    Trash2,
    FolderOpen,
    AlertTriangle,
    HardDrive,
    CheckCircle2,
    XCircle,
    Clock,
    Bot,
    Calendar,
    Folder,
} from 'lucide-react'
import {toast} from '@/components/ui/toast'
import {ApiError} from '@/api/http'
import {PageHeader} from '@/components/layout/PageHeader'
import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    useWorktrees,
    useSyncWorktrees,
    useDeleteWorktree,
    useDeleteOrphanedWorktree,
    useDeleteStaleWorktree,
} from '@/hooks/worktrees'
import {useRelativeTimeFormatter} from '@/hooks'
import {cn} from '@/lib/utils'
import type {TrackedWorktree, OrphanedWorktree, StaleWorktree} from 'shared'

type WorktreeType = 'tracked' | 'orphaned' | 'stale'

interface WorktreeItem extends MasterDetailItem {
    type: WorktreeType
    data: TrackedWorktree | OrphanedWorktree | StaleWorktree
}

type DeleteTarget =
    | {type: 'tracked'; item: TrackedWorktree; constraintError?: ApiError}
    | {type: 'orphaned'; item: OrphanedWorktree}
    | {type: 'stale'; item: StaleWorktree}
    | null

function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, i)
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function isActiveAttempt(status: string): boolean {
    return status === 'running' || status === 'pending' || status === 'queued'
}

function getStatusIcon(status: string) {
    const variants: Record<string, {className: string; icon: React.ReactNode}> = {
        running: {
            className: 'text-blue-500',
            icon: <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />,
        },
        pending: {className: 'text-amber-500', icon: <Clock className="h-3.5 w-3.5" />},
        queued: {className: 'text-violet-500', icon: <Clock className="h-3.5 w-3.5" />},
        success: {className: 'text-emerald-500', icon: <CheckCircle2 className="h-3.5 w-3.5" />},
        failed: {className: 'text-red-500', icon: <XCircle className="h-3.5 w-3.5" />},
        cancelled: {className: 'text-slate-400', icon: <XCircle className="h-3.5 w-3.5" />},
    }
    return variants[status] ?? {className: 'text-muted-foreground', icon: null}
}

function StatusBadge({status}: {status: string}) {
    const variant = getStatusIcon(status)
    return (
        <Badge variant="outline" className={cn('gap-1.5 border-current/20 bg-current/5', variant.className)}>
            {variant.icon}
            <span className="capitalize">{status}</span>
        </Badge>
    )
}

function NoProjectState() {
    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <PageHeader title="Worktrees" description="Manage git worktrees for your project." />
            <div className="flex flex-1 items-center justify-center p-8">
                <div className="relative flex max-w-md flex-col items-center gap-6 text-center">
                    <div className="absolute -inset-20 -z-10 rounded-full bg-gradient-to-br from-brand/5 via-transparent to-muted/10 blur-3xl" />
                    <div className="relative">
                        <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 blur-xl" />
                        <div className="relative flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-gradient-to-br from-card to-muted/30 shadow-lg shadow-black/5">
                            <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.02)_50%)] bg-[length:100%_4px]" />
                            <GitBranch className="size-9 text-muted-foreground/80" strokeWidth={1.5} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-semibold tracking-tight text-foreground">No Project Selected</h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Select a project from the sidebar to manage worktrees and clean up disk space.
                        </p>
                    </div>
                    <div className="mt-2 flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3 text-left text-xs text-muted-foreground">
                        <FolderOpen className="size-4 shrink-0 text-brand/70" />
                        <span>
                            Worktrees are created when you start an <strong className="font-medium text-foreground/80">Attempt</strong> on a card.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SummaryFooter({
    tracked,
    active,
    orphaned,
    stale,
    totalDiskUsage,
}: {
    tracked: number
    active: number
    orphaned: number
    stale: number
    totalDiskUsage: number
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                <HardDrive className="size-3.5" />
                Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/30 px-2.5 py-2">
                    <div className="font-medium tabular-nums">{tracked}</div>
                    <div className="text-muted-foreground/70">Tracked</div>
                </div>
                <div className="rounded-md bg-blue-500/10 px-2.5 py-2 text-blue-600 dark:text-blue-400">
                    <div className="font-medium tabular-nums">{active}</div>
                    <div className="opacity-70">Active</div>
                </div>
                {orphaned > 0 && (
                    <div className="rounded-md bg-amber-500/10 px-2.5 py-2 text-amber-600 dark:text-amber-400">
                        <div className="font-medium tabular-nums">{orphaned}</div>
                        <div className="opacity-70">Orphaned</div>
                    </div>
                )}
                {stale > 0 && (
                    <div className="rounded-md bg-red-500/10 px-2.5 py-2 text-red-600 dark:text-red-400">
                        <div className="font-medium tabular-nums">{stale}</div>
                        <div className="opacity-70">Stale</div>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-2 text-xs">
                <span className="text-muted-foreground/70">Disk Usage</span>
                <span className="font-medium tabular-nums">{formatBytes(totalDiskUsage)}</span>
            </div>
        </div>
    )
}

function TrackedWorktreeDetail({
    item,
    formatTime,
    onDelete,
}: {
    item: TrackedWorktree
    formatTime: (v: string | null | undefined) => string
    onDelete: () => void
}) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            <div className="mb-8 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
                        <GitBranch className="size-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">{item.cardTitle || item.ticketKey || 'Untitled'}</h1>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {item.ticketKey && item.cardTitle && (
                                <Badge variant="secondary" className="text-xs">{item.ticketKey}</Badge>
                            )}
                            <StatusBadge status={item.attemptStatus} />
                            {!item.existsOnDisk && (
                                <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="size-3" />
                                    Missing
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="mr-2 size-4" />
                    Delete
                </Button>
            </div>

            <div className="space-y-6">
                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Git Info</h2>
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="grid gap-px bg-border/30 sm:grid-cols-2">
                            <InfoRow icon={GitBranch} label="Branch" value={item.branchName} mono />
                            <InfoRow icon={GitBranch} label="Base Branch" value={item.baseBranch} mono />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Details</h2>
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="grid gap-px bg-border/30 sm:grid-cols-2">
                            <InfoRow icon={Bot} label="Agent" value={item.agent || 'Unknown'} />
                            <InfoRow icon={HardDrive} label="Disk Size" value={formatBytes(item.diskSizeBytes)} />
                            <InfoRow icon={Calendar} label="Created" value={formatTime(item.createdAt)} />
                            <InfoRow icon={Clock} label="Updated" value={formatTime(item.updatedAt)} />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Path</h2>
                    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                        <Folder className="size-4 shrink-0 text-muted-foreground" />
                        <code className="flex-1 truncate text-xs text-muted-foreground">{item.path}</code>
                    </div>
                </section>
            </div>
        </div>
    )
}

function OrphanedWorktreeDetail({
    item,
    formatTime,
    onDelete,
}: {
    item: OrphanedWorktree
    formatTime: (v: string | null | undefined) => string
    onDelete: () => void
}) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                        This directory exists on disk but is not tracked in the database. It may be leftover from an interrupted operation.
                    </div>
                </div>
            </div>

            <div className="mb-8 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-1 ring-amber-500/20">
                        <FolderOpen className="size-7 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">{item.name}</h1>
                        <Badge variant="outline" className="mt-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Orphaned
                        </Badge>
                    </div>
                </div>
                <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="mr-2 size-4" />
                    Delete
                </Button>
            </div>

            <div className="space-y-6">
                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Details</h2>
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="grid gap-px bg-border/30 sm:grid-cols-2">
                            {item.branchName && <InfoRow icon={GitBranch} label="Branch" value={item.branchName} mono />}
                            <InfoRow icon={HardDrive} label="Disk Size" value={formatBytes(item.diskSizeBytes)} />
                            <InfoRow icon={Clock} label="Last Modified" value={formatTime(item.lastModified)} />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Path</h2>
                    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                        <Folder className="size-4 shrink-0 text-muted-foreground" />
                        <code className="flex-1 truncate text-xs text-muted-foreground">{item.path}</code>
                    </div>
                </section>
            </div>
        </div>
    )
}

function StaleWorktreeDetail({
    item,
    formatTime,
    onDelete,
}: {
    item: StaleWorktree
    formatTime: (v: string | null | undefined) => string
    onDelete: () => void
}) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                        This database record references a worktree that no longer exists on disk. Clean it up to remove the stale entry.
                    </div>
                </div>
            </div>

            <div className="mb-8 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 ring-1 ring-red-500/20">
                        <XCircle className="size-7 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">{item.cardTitle || 'Untitled'}</h1>
                        <Badge variant="outline" className="mt-1.5 border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
                            Stale Record
                        </Badge>
                    </div>
                </div>
                <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="mr-2 size-4" />
                    Remove
                </Button>
            </div>

            <div className="space-y-6">
                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Details</h2>
                    <div className="rounded-lg border border-border/50 bg-card/50">
                        <div className="grid gap-px bg-border/30 sm:grid-cols-2">
                            <InfoRow icon={GitBranch} label="Branch" value={item.branchName} mono />
                            <InfoRow icon={Calendar} label="Created" value={formatTime(item.createdAt)} />
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Missing Path</h2>
                    <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <Folder className="size-4 shrink-0 text-red-500/70" />
                        <code className="flex-1 truncate text-xs text-red-600/80 dark:text-red-400/80">{item.path}</code>
                    </div>
                </section>
            </div>
        </div>
    )
}

function InfoRow({
    icon: Icon,
    label,
    value,
    mono,
}: {
    icon: React.ComponentType<{className?: string}>
    label: string
    value: string
    mono?: boolean
}) {
    return (
        <div className="flex items-center gap-3 bg-card/50 px-4 py-3">
            <Icon className="size-4 shrink-0 text-muted-foreground/60" />
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</div>
                <div className={cn('mt-0.5 truncate text-sm', mono && 'font-mono text-xs')}>{value}</div>
            </div>
        </div>
    )
}

function EmptySelection() {
    return (
        <div className="flex h-full items-center justify-center p-8">
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/30">
                    <GitBranch className="size-8 text-muted-foreground/40" />
                </div>
                <div>
                    <h3 className="font-medium text-foreground">Select a Worktree</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Choose a worktree from the sidebar to view details and manage it.
                    </p>
                </div>
            </div>
        </div>
    )
}

function DeleteConfirmDialog({
    target,
    onClose,
    onConfirm,
    isPending,
}: {
    target: DeleteTarget
    onClose: () => void
    onConfirm: (force: boolean, deleteBranch: boolean, deleteRemoteBranch: boolean) => void
    isPending: boolean
}) {
    const [forceDelete, setForceDelete] = useState(false)
    const [deleteBranch, setDeleteBranch] = useState(true)
    const [deleteRemoteBranch, setDeleteRemoteBranch] = useState(true)

    if (!target) return null

    const isTracked = target.type === 'tracked'
    const isActive = isTracked && isActiveAttempt(target.item.attemptStatus)
    const hasConstraint = isTracked && target.constraintError !== undefined
    const cardNotInDone = hasConstraint && target.constraintError?.problem?.cardActive === true
    const showForceCheckbox = isActive || cardNotInDone
    const title = isTracked
        ? target.item.cardTitle || target.item.ticketKey || 'this worktree'
        : target.type === 'orphaned'
          ? target.item.name
          : target.item.cardTitle || 'this record'

    const description = (() => {
        if (target.type === 'tracked') {
            if (isActive) {
                return '⚠️ This worktree has an active attempt. Deleting it will terminate the running agent and permanently destroy all uncommitted and unpushed changes. The ticket progress will be lost.'
            }
            if (cardNotInDone) {
                return '⚠️ This card is not in Done column. Deleting the worktree will permanently destroy all uncommitted and unpushed changes. The ticket progress will be lost.'
            }
            return '⚠️ This will permanently remove the worktree directory from disk. Any uncommitted or unpushed changes will be lost forever. The Git branch will remain in the repository.'
        }
        if (target.type === 'orphaned') {
            return '⚠️ This worktree exists on disk but is not tracked in the database. Deleting it will permanently remove the directory and all uncommitted changes.'
        }
        return 'This database record points to a worktree that no longer exists on disk. Deleting it will clean up the stale entry.'
    })()

    return (
        <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-5 shrink-0 text-destructive" />
                        <span>Delete {target.type === 'stale' ? 'Record' : 'Worktree'}</span>
                    </DialogTitle>
                    <DialogDescription className="text-left">{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        {target.type !== 'stale' && (
                            <p className="mt-1 break-all text-xs font-mono text-muted-foreground">
                                {target.item.path}
                            </p>
                        )}
                    </div>
                    {target.type === 'tracked' && (
                        <>
                            <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                                <input
                                    type="checkbox"
                                    checked={deleteBranch}
                                    onChange={(e) => setDeleteBranch(e.target.checked)}
                                    className="mt-0.5 size-4 shrink-0 rounded"
                                />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Also delete local branch</p>
                                    <p className="text-xs text-muted-foreground">
                                        Remove the Git branch from your local repository
                                    </p>
                                </div>
                            </label>
                            <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
                                <input
                                    type="checkbox"
                                    checked={deleteRemoteBranch}
                                    onChange={(e) => setDeleteRemoteBranch(e.target.checked)}
                                    className="mt-0.5 size-4 shrink-0 rounded"
                                />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Also delete remote branch</p>
                                    <p className="text-xs text-muted-foreground">
                                        Remove the Git branch from the remote repository (e.g., GitHub)
                                    </p>
                                </div>
                            </label>
                        </>
                    )}
                    {showForceCheckbox && (
                        <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                            <input
                                type="checkbox"
                                checked={forceDelete}
                                onChange={(e) => setForceDelete(e.target.checked)}
                                className="mt-0.5 size-4 shrink-0 rounded border-amber-500/50 text-amber-600 focus:ring-amber-500"
                            />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                    {isActive ? 'Force delete active worktree' : 'Force delete'}
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    {isActive
                                        ? '⚠️ I understand this will terminate the running agent and permanently destroy all uncommitted/unpushed changes.'
                                        : cardNotInDone
                                          ? '⚠️ I understand this will permanently destroy all uncommitted/unpushed changes and the ticket progress will be lost.'
                                          : '⚠️ I understand all uncommitted and unpushed changes will be permanently lost.'}
                                </p>
                            </div>
                        </label>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => onConfirm(forceDelete, deleteBranch, deleteRemoteBranch)}
                        disabled={isPending || (showForceCheckbox && !forceDelete)}
                    >
                        {isPending ? (
                            <>
                                <RefreshCw className="mr-2 size-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="mr-2 size-4" />
                                Delete
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function WorktreesPage() {
    const {projectId} = useParams<{projectId: string}>()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
    const formatTime = useRelativeTimeFormatter(30_000)

    const {data, isLoading, isError, refetch} = useWorktrees(projectId)
    const syncMutation = useSyncWorktrees()
    const deleteTrackedMutation = useDeleteWorktree()
    const deleteOrphanedMutation = useDeleteOrphanedWorktree()
    const deleteStaleMutation = useDeleteStaleWorktree()

    const tracked = data?.tracked ?? []
    const orphaned = data?.orphaned ?? []
    const stale = data?.stale ?? []
    const summary = data?.summary ?? {tracked: 0, active: 0, orphaned: 0, stale: 0, totalDiskUsage: 0}

    const allItems: WorktreeItem[] = useMemo(() => {
        const items: WorktreeItem[] = []

        for (const t of tracked) {
            items.push({
                id: `tracked-${t.id}`,
                type: 'tracked',
                label: t.cardTitle || t.ticketKey || 'Untitled',
                subtitle: t.branchName,
                icon: GitBranch,
                data: t,
            })
        }

        for (const o of orphaned) {
            items.push({
                id: `orphaned-${o.path}`,
                type: 'orphaned',
                label: o.name,
                subtitle: o.branchName || 'Unknown branch',
                icon: FolderOpen,
                data: o,
            })
        }

        for (const s of stale) {
            items.push({
                id: `stale-${s.id}`,
                type: 'stale',
                label: s.cardTitle || 'Untitled',
                subtitle: s.branchName,
                icon: AlertTriangle,
                data: s,
            })
        }

        return items
    }, [tracked, orphaned, stale])

    const selectedItem = allItems.find((item) => item.id === selectedId)

    if (!projectId) {
        return <NoProjectState />
    }

    const handleSync = () => {
        syncMutation.mutate(
            {projectId},
            {
                onSuccess: () => {
                    toast({
                        title: 'Synced',
                        description: 'Worktrees have been synchronized.',
                        variant: 'success',
                    })
                },
                onError: (error) => {
                    toast({
                        title: 'Sync failed',
                        description: error instanceof Error ? error.message : 'An unknown error occurred',
                        variant: 'destructive',
                    })
                },
            }
        )
    }

    const handleDelete = (force: boolean, deleteBranch: boolean, deleteRemoteBranch: boolean) => {
        if (!deleteTarget || !projectId) return

        const onSuccess = () => {
            const wasForced = force && deleteTarget.type === 'tracked'
            setDeleteTarget(null)
            if (selectedItem && (
                (deleteTarget.type === 'tracked' && selectedItem.id === `tracked-${deleteTarget.item.id}`) ||
                (deleteTarget.type === 'orphaned' && selectedItem.id === `orphaned-${deleteTarget.item.path}`) ||
                (deleteTarget.type === 'stale' && selectedItem.id === `stale-${deleteTarget.item.id}`)
            )) {
                setSelectedId(null)
            }

            let description = 'Worktree has been removed from disk.'
            if (deleteBranch && deleteRemoteBranch) {
                description += ' Both local and remote branches have been deleted.'
            } else if (deleteBranch) {
                description += ' The local branch has been deleted. Remote branch still exists.'
            } else if (deleteRemoteBranch) {
                description += ' The remote branch has been deleted. Local branch still exists.'
            } else {
                description += ' The Git branches still exist in the repository.'
            }

            if (wasForced) {
                description = '⚠️ Worktree force deleted. Any uncommitted changes and unpushed commits are permanently lost. ' + description
            }

            toast({
                title: wasForced ? '⚠️ Worktree force deleted' : 'Worktree deleted',
                description,
                variant: wasForced ? 'destructive' : 'success',
            })
        }

        const onError = (error: unknown) => {
            if (error instanceof ApiError && error.status === 409) {
                if (deleteTarget.type === 'tracked') {
                    setDeleteTarget({...deleteTarget, constraintError: error})
                    setForceDelete(false)
                }
                toast({
                    title: 'Cannot delete worktree',
                    description:
                        error.problem?.detail ||
                        error.message ||
                        'This worktree cannot be deleted because it has an active attempt or the card is not in Done column.',
                    variant: 'destructive',
                })
            } else {
                toast({
                    title: 'Delete failed',
                    description: error instanceof Error ? error.message : 'An unknown error occurred',
                    variant: 'destructive',
                })
            }
        }

        if (deleteTarget.type === 'tracked') {
            deleteTrackedMutation.mutate(
                {
                    projectId,
                    worktreeId: deleteTarget.item.id,
                    options: {
                        force,
                        deleteBranch,
                        deleteRemoteBranch,
                    },
                },
                {onSuccess, onError}
            )
        } else if (deleteTarget.type === 'orphaned') {
            const encodedPath = encodeURIComponent(deleteTarget.item.path)
            deleteOrphanedMutation.mutate({projectId, encodedPath, options: {confirm: true}}, {onSuccess, onError})
        } else if (deleteTarget.type === 'stale') {
            deleteStaleMutation.mutate({projectId, worktreeId: deleteTarget.item.id, options: {confirm: true}}, {onSuccess, onError})
        }
    }

    const isPending =
        deleteTrackedMutation.isPending || deleteOrphanedMutation.isPending || deleteStaleMutation.isPending

    const renderItem = (item: WorktreeItem, isActive: boolean, _defaultRender: () => React.ReactNode) => {
        const typeStyles = {
            tracked: '',
            orphaned: 'text-amber-600 dark:text-amber-400',
            stale: 'text-red-600 dark:text-red-400',
        }

        const typeBadges = {
            tracked: null,
            orphaned: (
                <span className="flex size-1.5 rounded-full bg-amber-500" />
            ),
            stale: (
                <span className="flex size-1.5 rounded-full bg-red-500" />
            ),
        }

        const Icon = item.icon

        return (
            <button
                onClick={() => setSelectedId(item.id)}
                className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                    'transition-all duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
            >
                <span
                    className={cn(
                        'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
                        'transition-all duration-200 ease-out',
                        isActive
                            ? 'bg-sidebar-primary opacity-100'
                            : 'bg-transparent opacity-0 group-hover:bg-muted-foreground/30 group-hover:opacity-100'
                    )}
                />
                <span
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        'transition-all duration-150 ease-out',
                        isActive
                            ? cn('bg-sidebar-primary/10', typeStyles[item.type] || 'text-sidebar-primary')
                            : cn('bg-transparent group-hover:bg-sidebar-accent', typeStyles[item.type] || 'text-muted-foreground group-hover:text-sidebar-foreground')
                    )}
                >
                    <Icon
                        className={cn(
                            'size-[18px] transition-transform duration-150',
                            'group-hover:scale-105',
                            isActive && 'scale-105'
                        )}
                        strokeWidth={isActive ? 2 : 1.75}
                    />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span
                            className={cn(
                                'block truncate text-[13px] leading-tight',
                                'transition-colors duration-150',
                                isActive ? 'font-medium' : 'font-normal'
                            )}
                        >
                            {item.label}
                        </span>
                        {typeBadges[item.type]}
                    </span>
                    {item.subtitle && (
                        <span
                            className={cn(
                                'mt-0.5 block truncate font-mono text-[11px] leading-tight',
                                'transition-colors duration-150',
                                isActive ? 'text-sidebar-foreground/60' : 'text-muted-foreground/60'
                            )}
                        >
                            {item.subtitle}
                        </span>
                    )}
                </span>
            </button>
        )
    }

    const renderDetail = () => {
        if (!selectedItem) return <EmptySelection />

        if (selectedItem.type === 'tracked') {
            return (
                <TrackedWorktreeDetail
                    item={selectedItem.data as TrackedWorktree}
                    formatTime={formatTime}
                    onDelete={() => setDeleteTarget({type: 'tracked', item: selectedItem.data as TrackedWorktree})}
                />
            )
        }

        if (selectedItem.type === 'orphaned') {
            return (
                <OrphanedWorktreeDetail
                    item={selectedItem.data as OrphanedWorktree}
                    formatTime={formatTime}
                    onDelete={() => setDeleteTarget({type: 'orphaned', item: selectedItem.data as OrphanedWorktree})}
                />
            )
        }

        if (selectedItem.type === 'stale') {
            return (
                <StaleWorktreeDetail
                    item={selectedItem.data as StaleWorktree}
                    formatTime={formatTime}
                    onDelete={() => setDeleteTarget({type: 'stale', item: selectedItem.data as StaleWorktree})}
                />
            )
        }

        return <EmptySelection />
    }

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <PageHeader
                title="Worktrees"
                description={data?.projectName ? `Git worktrees for ${data.projectName}` : 'Manage git worktrees for your project.'}
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSync}
                        disabled={syncMutation.isPending || isLoading}
                    >
                        <RefreshCw className={cn('mr-2 size-4', syncMutation.isPending && 'animate-spin')} />
                        {syncMutation.isPending ? 'Syncing...' : 'Sync'}
                    </Button>
                }
            />

            <MasterDetailLayout<WorktreeItem>
                title="Worktrees"
                items={allItems}
                activeId={selectedId}
                onSelect={setSelectedId}
                loading={isLoading}
                renderItem={renderItem}
                sidebarFooter={
                    !isLoading && !isError && (
                        <SummaryFooter
                            tracked={summary.tracked}
                            active={summary.active}
                            orphaned={summary.orphaned}
                            stale={summary.stale}
                            totalDiskUsage={summary.totalDiskUsage}
                        />
                    )
                }
                emptyState={
                    isError ? (
                        <div className="flex h-32 flex-col items-center justify-center gap-3 text-center">
                            <AlertTriangle className="size-6 text-destructive" />
                            <div>
                                <p className="text-sm font-medium">Failed to load</p>
                                <Button variant="link" size="sm" onClick={() => refetch()} className="mt-1 h-auto p-0 text-xs">
                                    Try again
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
                            <GitBranch className="size-8 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">No worktrees yet</p>
                        </div>
                    )
                }
            >
                {renderDetail()}
            </MasterDetailLayout>

            <DeleteConfirmDialog
                target={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                isPending={isPending}
            />
        </div>
    )
}
