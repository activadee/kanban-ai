import {useState} from 'react'
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
} from 'lucide-react'
import {PageHeader} from '@/components/layout/PageHeader'
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@/components/ui/tabs'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
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
import type {TrackedWorktree, OrphanedWorktree, StaleWorktree} from 'shared'

type DeleteTarget =
    | {type: 'tracked'; item: TrackedWorktree}
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

function StatusBadge({status}: {status: string}) {
    const variants: Record<string, {className: string; icon: React.ReactNode}> = {
        running: {
            className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            icon: <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />,
        },
        pending: {
            className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            icon: <Clock className="h-3 w-3" />,
        },
        queued: {
            className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
            icon: <Clock className="h-3 w-3" />,
        },
        success: {
            className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            icon: <CheckCircle2 className="h-3 w-3" />,
        },
        failed: {
            className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
            icon: <XCircle className="h-3 w-3" />,
        },
        cancelled: {
            className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
            icon: <XCircle className="h-3 w-3" />,
        },
    }

    const variant = variants[status] ?? {
        className: 'bg-muted text-muted-foreground',
        icon: null,
    }

    return (
        <Badge variant="outline" className={`gap-1.5 ${variant.className}`}>
            {variant.icon}
            {status}
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

function LoadingState() {
    return (
        <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-sm text-muted-foreground">Loading worktrees...</p>
            </div>
        </div>
    )
}

function ErrorState({onRetry}: {onRetry: () => void}) {
    return (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-8 text-destructive" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-foreground">Failed to load worktrees</p>
                <p className="mt-1 text-xs text-muted-foreground">There was an error fetching worktree data.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-2 size-4" />
                Try again
            </Button>
        </div>
    )
}

function EmptyTabState({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{className?: string}>
    title: string
    description: string
}) {
    return (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
                <Icon className="size-6 text-muted-foreground" />
            </div>
            <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
        </div>
    )
}

function SummaryCards({
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
    const stats = [
        {label: 'Total Tracked', value: tracked, color: 'text-foreground'},
        {label: 'Active', value: active, color: 'text-blue-600 dark:text-blue-400'},
        {label: 'Orphaned', value: orphaned, color: orphaned > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'},
        {label: 'Stale', value: stale, color: stale > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'},
    ]

    return (
        <Card className="border-border/50 bg-gradient-to-br from-card to-muted/10">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <HardDrive className="size-4 text-muted-foreground" />
                    Worktree Summary
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {stats.map((stat) => (
                        <div key={stat.label} className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                            <p className={`text-2xl font-semibold tabular-nums ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disk Usage</p>
                        <p className="text-2xl font-semibold tabular-nums text-foreground">{formatBytes(totalDiskUsage)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function TrackedWorktreeRow({
    item,
    formatTime,
    onDelete,
}: {
    item: TrackedWorktree
    formatTime: (v: string | null | undefined) => string
    onDelete: () => void
}) {
    return (
        <div className="group flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:bg-muted/30">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-muted/50 to-muted/20">
                <GitBranch className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{item.cardTitle || item.ticketKey || 'Untitled'}</p>
                    {item.ticketKey && item.cardTitle && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {item.ticketKey}
                        </Badge>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{item.branchName}</span>
                    <span className="text-border">•</span>
                    <span>{formatTime(item.createdAt)}</span>
                    {item.diskSizeBytes != null && (
                        <>
                            <span className="text-border">•</span>
                            <span>{formatBytes(item.diskSizeBytes)}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                {item.agent && (
                    <Badge variant="outline" className="gap-1.5 border-border/50 text-muted-foreground">
                        <Bot className="size-3" />
                        {item.agent}
                    </Badge>
                )}
                <StatusBadge status={item.attemptStatus} />
                {!item.existsOnDisk && (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mr-1 size-3" />
                        Missing
                    </Badge>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={onDelete}
                >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                </Button>
            </div>
        </div>
    )
}

function OrphanedWorktreeRow({
    item,
    formatTime,
    onDelete,
}: {
    item: OrphanedWorktree
    formatTime: (v: string | null | undefined) => string
    onDelete: () => void
}) {
    return (
        <div className="group flex items-center gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 transition-colors hover:bg-amber-500/10">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <FolderOpen className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.branchName && <span className="font-mono">{item.branchName}</span>}
                    {item.branchName && <span className="text-border">•</span>}
                    <span>{formatTime(item.lastModified)}</span>
                    <span className="text-border">•</span>
                    <span>{formatBytes(item.diskSizeBytes)}</span>
                </div>
                <p className="truncate text-[11px] font-mono text-muted-foreground/70">{item.path}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mr-1 size-3" />
                    Orphaned
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={onDelete}
                >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                </Button>
            </div>
        </div>
    )
}

function StaleWorktreeRow({
    item,
    formatTime,
    onDelete,
}: {
    item: StaleWorktree
    formatTime: (v: string | null | undefined) => string
    onDelete: () => void
}) {
    return (
        <div className="group flex items-center gap-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 transition-colors hover:bg-red-500/10">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <XCircle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">{item.cardTitle || 'Untitled'}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{item.branchName}</span>
                    <span className="text-border">•</span>
                    <span>{formatTime(item.createdAt)}</span>
                </div>
                <p className="truncate text-[11px] font-mono text-muted-foreground/70">{item.path}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
                    <XCircle className="mr-1 size-3" />
                    Stale
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={onDelete}
                >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                </Button>
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
    onConfirm: (force: boolean) => void
    isPending: boolean
}) {
    const [forceDelete, setForceDelete] = useState(false)

    if (!target) return null

    const isTracked = target.type === 'tracked'
    const isActive = isTracked && isActiveAttempt(target.item.attemptStatus)
    const title = isTracked
        ? target.item.cardTitle || target.item.ticketKey || 'this worktree'
        : target.type === 'orphaned'
          ? target.item.name
          : target.item.cardTitle || 'this record'

    const getDescription = () => {
        if (target.type === 'tracked') {
            if (isActive) {
                return 'This worktree has an active attempt. Deleting it will terminate the running agent and remove all unsaved work.'
            }
            return 'This will remove the worktree from disk and clean up the database record.'
        }
        if (target.type === 'orphaned') {
            return 'This worktree exists on disk but is not tracked in the database. Deleting it will permanently remove the directory.'
        }
        return 'This database record points to a worktree that no longer exists on disk. Deleting it will clean up the stale entry.'
    }

    return (
        <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-5 text-destructive" />
                        Delete {target.type === 'stale' ? 'Record' : 'Worktree'}
                    </DialogTitle>
                    <DialogDescription className="text-left">{getDescription()}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        {target.type !== 'stale' && (
                            <p className="mt-1 truncate text-xs font-mono text-muted-foreground">
                                {target.type === 'tracked' ? target.item.path : target.item.path}
                            </p>
                        )}
                    </div>
                    {isActive && (
                        <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                            <input
                                type="checkbox"
                                checked={forceDelete}
                                onChange={(e) => setForceDelete(e.target.checked)}
                                className="mt-0.5 size-4 rounded border-amber-500/50 text-amber-600 focus:ring-amber-500"
                            />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Force delete active worktree</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    I understand this will terminate the running agent and may cause data loss.
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
                        onClick={() => onConfirm(forceDelete)}
                        disabled={isPending || (isActive && !forceDelete)}
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
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
    const formatTime = useRelativeTimeFormatter(30_000)

    const {data, isLoading, isError, refetch} = useWorktrees(projectId)
    const syncMutation = useSyncWorktrees()
    const deleteTrackedMutation = useDeleteWorktree()
    const deleteOrphanedMutation = useDeleteOrphanedWorktree()
    const deleteStaleMutation = useDeleteStaleWorktree()

    if (!projectId) {
        return <NoProjectState />
    }

    const handleSync = () => {
        syncMutation.mutate({projectId})
    }

    const handleDelete = (force: boolean) => {
        if (!deleteTarget || !projectId) return

        const onSuccess = () => setDeleteTarget(null)

        if (deleteTarget.type === 'tracked') {
            deleteTrackedMutation.mutate(
                {projectId, worktreeId: deleteTarget.item.id, options: force ? {force: true} : undefined},
                {onSuccess}
            )
        } else if (deleteTarget.type === 'orphaned') {
            const encodedPath = encodeURIComponent(deleteTarget.item.path)
            deleteOrphanedMutation.mutate({projectId, encodedPath, options: {confirm: true}}, {onSuccess})
        } else if (deleteTarget.type === 'stale') {
            deleteStaleMutation.mutate({projectId, worktreeId: deleteTarget.item.id, options: {confirm: true}}, {onSuccess})
        }
    }

    const isPending =
        deleteTrackedMutation.isPending || deleteOrphanedMutation.isPending || deleteStaleMutation.isPending

    const tracked = data?.tracked ?? []
    const orphaned = data?.orphaned ?? []
    const stale = data?.stale ?? []
    const summary = data?.summary ?? {tracked: 0, active: 0, orphaned: 0, stale: 0, totalDiskUsage: 0}

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
                        <RefreshCw className={`mr-2 size-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        {syncMutation.isPending ? 'Syncing...' : 'Sync'}
                    </Button>
                }
            />
            <div className="flex-1 overflow-auto">
                <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                    {isLoading ? (
                        <LoadingState />
                    ) : isError ? (
                        <ErrorState onRetry={() => refetch()} />
                    ) : (
                        <>
                            <SummaryCards
                                tracked={summary.tracked}
                                active={summary.active}
                                orphaned={summary.orphaned}
                                stale={summary.stale}
                                totalDiskUsage={summary.totalDiskUsage}
                            />

                            <Tabs defaultValue="active" className="space-y-4">
                                <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-none">
                                    <TabsTrigger value="active" className="gap-2">
                                        <GitBranch className="size-4" />
                                        <span className="hidden sm:inline">Active</span>
                                        <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] px-1.5 text-[10px]">
                                            {tracked.length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="orphaned" className="gap-2">
                                        <FolderOpen className="size-4" />
                                        <span className="hidden sm:inline">Orphaned</span>
                                        <Badge
                                            variant="secondary"
                                            className={`ml-1 h-5 min-w-[1.25rem] px-1.5 text-[10px] ${orphaned.length > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : ''}`}
                                        >
                                            {orphaned.length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="stale" className="gap-2">
                                        <AlertTriangle className="size-4" />
                                        <span className="hidden sm:inline">Stale</span>
                                        <Badge
                                            variant="secondary"
                                            className={`ml-1 h-5 min-w-[1.25rem] px-1.5 text-[10px] ${stale.length > 0 ? 'bg-red-500/20 text-red-600 dark:text-red-400' : ''}`}
                                        >
                                            {stale.length}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="active" className="space-y-3">
                                    {tracked.length === 0 ? (
                                        <EmptyTabState
                                            icon={GitBranch}
                                            title="No tracked worktrees"
                                            description="Worktrees are created when you start an Attempt on a card."
                                        />
                                    ) : (
                                        tracked.map((item) => (
                                            <TrackedWorktreeRow
                                                key={item.id}
                                                item={item}
                                                formatTime={formatTime}
                                                onDelete={() => setDeleteTarget({type: 'tracked', item})}
                                            />
                                        ))
                                    )}
                                </TabsContent>

                                <TabsContent value="orphaned" className="space-y-3">
                                    {orphaned.length === 0 ? (
                                        <EmptyTabState
                                            icon={FolderOpen}
                                            title="No orphaned worktrees"
                                            description="All worktree directories on disk are properly tracked."
                                        />
                                    ) : (
                                        <>
                                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                                    <AlertTriangle className="mr-2 inline size-4" />
                                                    These directories exist on disk but are not tracked in the database. They may be leftover from
                                                    interrupted operations or manual worktree creation.
                                                </p>
                                            </div>
                                            {orphaned.map((item) => (
                                                <OrphanedWorktreeRow
                                                    key={item.path}
                                                    item={item}
                                                    formatTime={formatTime}
                                                    onDelete={() => setDeleteTarget({type: 'orphaned', item})}
                                                />
                                            ))}
                                        </>
                                    )}
                                </TabsContent>

                                <TabsContent value="stale" className="space-y-3">
                                    {stale.length === 0 ? (
                                        <EmptyTabState
                                            icon={AlertTriangle}
                                            title="No stale records"
                                            description="All database records have corresponding worktree directories."
                                        />
                                    ) : (
                                        <>
                                            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                                                <p className="text-sm text-red-700 dark:text-red-300">
                                                    <AlertTriangle className="mr-2 inline size-4" />
                                                    These database records reference worktree directories that no longer exist on disk. Clean them up
                                                    to remove stale entries.
                                                </p>
                                            </div>
                                            {stale.map((item) => (
                                                <StaleWorktreeRow
                                                    key={item.id}
                                                    item={item}
                                                    formatTime={formatTime}
                                                    onDelete={() => setDeleteTarget({type: 'stale', item})}
                                                />
                                            ))}
                                        </>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </>
                    )}
                </div>
            </div>

            <DeleteConfirmDialog
                target={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                isPending={isPending}
            />
        </div>
    )
}
