import {useEffect, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {X} from 'lucide-react'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {toast} from '@/components/ui/toast'
import {projectsKeys} from '@/lib/queryClient'
import {useNextTicketKey, useProjectSettings, useImagePaste} from '@/hooks'
import {DependenciesPicker} from '@/components/kanban/DependenciesPicker'
import type {CardFormValues, BaseDialogProps} from './types'
import type {TicketType} from 'shared'
import {defaultTicketType, ticketTypeOptions} from '@/lib/ticketTypes'
import {useGithubAuthStatus} from '@/hooks/github'
import {useProjectGithubOrigin} from '@/hooks/projects'

type CreateProps = BaseDialogProps & {
    columns: { id: string; title: string }[]
    defaultColumnId?: string
    projectId: string
    onSubmit: (columnId: string, values: CardFormValues) => Promise<void> | void
    availableCards?: { id: string; title: string; ticketKey?: string }[]
    onCreateAndEnhance?: (columnId: string, values: CardFormValues) => Promise<void> | void
}

export function CreateCardDialog({
                                     open,
                                     onOpenChange,
                                     columns,
                                     defaultColumnId,
                                     projectId,
                                     onSubmit,
                                     availableCards = [],
                                     onCreateAndEnhance,
                                 }: CreateProps) {
    const [values, setValues] = useState<CardFormValues>({
        title: '',
        description: '',
        dependsOn: [],
        ticketType: defaultTicketType,
        createGithubIssue: false,
    })
    const [columnId, setColumnId] = useState<string>(defaultColumnId ?? columns[0]?.id ?? '')
    const [submitting, setSubmitting] = useState(false)
    const queryClient = useQueryClient()
    const {pendingImages, addImagesFromClipboard, addImagesFromDataTransfer, removeImage, clearImages, canAddMore} = useImagePaste()

    const previewQuery = useNextTicketKey(projectId, {
        enabled: open && Boolean(projectId),
        staleTime: 5_000,
    })

    const settingsQuery = useProjectSettings(projectId, {
        enabled: open && Boolean(projectId),
        staleTime: 30_000,
    })
    const githubCheckQuery = useGithubAuthStatus({enabled: open})
    const originQuery = useProjectGithubOrigin(projectId, {enabled: open && Boolean(projectId)})

    const hasGithubConnection = githubCheckQuery.data?.status === 'valid'
    const origin = originQuery.data
    const hasOrigin = Boolean(origin?.owner && origin?.repo)
    const autoCreateEnabled = Boolean(settingsQuery.data?.githubIssueAutoCreateEnabled)
    const canCreateGithubIssue = autoCreateEnabled && hasGithubConnection && hasOrigin

    useEffect(() => {
        if (!open) {
            setValues({title: '', description: '', dependsOn: [], ticketType: defaultTicketType, createGithubIssue: false})
            setColumnId(defaultColumnId ?? columns[0]?.id ?? '')
            clearImages()
        }
    }, [open, columns, defaultColumnId, clearImages])

    const handleSubmit = async () => {
        if (!values.title.trim() || !columnId) return
        try {
            setSubmitting(true)
            await onSubmit(columnId, {
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn ?? [],
                ticketType: values.ticketType ?? null,
                createGithubIssue: values.createGithubIssue === true && canCreateGithubIssue,
            })
            onOpenChange(false)
            setValues({title: '', description: '', dependsOn: [], ticketType: defaultTicketType, createGithubIssue: false})
            setColumnId(defaultColumnId ?? columns[0]?.id ?? '')
            await queryClient.invalidateQueries({queryKey: projectsKeys.nextTicketKey(projectId)})
        } finally {
            setSubmitting(false)
        }
    }

    const handleCreateAndEnhance = async () => {
        if (!values.title.trim() || !columnId) return
        const handler = onCreateAndEnhance ?? onSubmit
        try {
            setSubmitting(true)
            await handler(columnId, {
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn ?? [],
                ticketType: values.ticketType ?? null,
                createGithubIssue: values.createGithubIssue === true && canCreateGithubIssue,
                images: pendingImages.length > 0 ? pendingImages : undefined,
            })
            onOpenChange(false)
            setValues({title: '', description: '', dependsOn: [], ticketType: defaultTicketType, createGithubIssue: false})
            setColumnId(defaultColumnId ?? columns[0]?.id ?? '')
            clearImages()
            await queryClient.invalidateQueries({queryKey: projectsKeys.nextTicketKey(projectId)})
        } finally {
            setSubmitting(false)
        }
    }

    const handleDescriptionPaste = async (e: React.ClipboardEvent) => {
        if (!canAddMore) return
        const clipboardEvent = e.nativeEvent as ClipboardEvent
        const errors = await addImagesFromClipboard(clipboardEvent)
        if (errors.length > 0) {
            toast({title: 'Image error', description: errors[0].message, variant: 'destructive'})
        }
    }

    const handleDescriptionDrop = async (e: React.DragEvent) => {
        if (!canAddMore) return
        e.preventDefault()
        const errors = await addImagesFromDataTransfer(e.dataTransfer)
        if (errors.length > 0) {
            toast({title: 'Image error', description: errors[0].message, variant: 'destructive'})
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Ticket</DialogTitle>
                    <DialogDescription>Create a new ticket for this board.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Column</Label>
                        <Select value={columnId} onValueChange={(v) => setColumnId(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select column"/>
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                {columns.map((column) => (
                                    <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="card-title">Title</Label>
                        <Input
                            id="card-title"
                            autoFocus
                            value={values.title}
                            onChange={(event) => setValues((prev) => ({...prev, title: event.target.value}))}
                            placeholder="Summarize the task"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="card-desc">Description</Label>
                        <Textarea
                            id="card-desc"
                            rows={4}
                            value={values.description}
                            onChange={(e) => setValues((p) => ({...p, description: e.target.value}))}
                            onPaste={handleDescriptionPaste}
                            onDrop={handleDescriptionDrop}
                            onDragOver={(e) => e.preventDefault()}
                            placeholder={canAddMore ? 'Describe the task... (paste or drop images here)' : 'Describe the task...'}
                        />
                        {pendingImages.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {pendingImages.map((img, idx) => (
                                    <div key={idx} className="relative group">
                                        <img
                                            src={`data:${img.mime};base64,${img.data}`}
                                            alt={img.name || `Image ${idx + 1}`}
                                            className="h-16 w-16 object-cover rounded border"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {pendingImages.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {pendingImages.length} image{pendingImages.length !== 1 ? 's' : ''} attached (sent with &quot;Create &amp; Enhance&quot;)
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="card-type">Type</Label>
                        <Select
                            value={(values.ticketType ?? 'none') as string}
                            onValueChange={(next) =>
                                setValues((prev) => ({
                                    ...prev,
                                    ticketType: next === 'none' ? null : (next as TicketType),
                                }))
                            }
                        >
                            <SelectTrigger id="card-type" className="w-full">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                <SelectItem value="none">None</SelectItem>
                                {ticketTypeOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Dependencies</Label>
                        <div className="flex flex-wrap items-center gap-2">
                            {values.dependsOn && values.dependsOn.length === 0 ? (
                                <span className="text-xs text-muted-foreground">None</span>
                            ) : null}
                        </div>
                        <DependenciesPicker
                            availableCards={availableCards}
                            value={values.dependsOn ?? []}
                            onChange={(ids) => setValues((prev) => ({...prev, dependsOn: ids}))}
                            triggerLabel="Select dependencies"
                            hint="Choose tickets that must be Done before this can start."
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="create-github-issue"
                                checked={values.createGithubIssue === true}
                                disabled={!canCreateGithubIssue || submitting}
                                onCheckedChange={(checked) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        createGithubIssue: checked === true,
                                    }))
                                }
                            />
                            <div className="space-y-1">
                                <Label htmlFor="create-github-issue">Create GitHub Issue</Label>
                                <p className="text-xs text-muted-foreground">
                                    {origin?.owner && origin?.repo
                                        ? `Creates an issue in ${origin.owner}/${origin.repo} when this ticket is created.`
                                        : 'Creates an issue in the project’s GitHub repository when this ticket is created.'}
                                </p>
                                {!canCreateGithubIssue ? (
                                    <p className="text-xs text-muted-foreground">
                                        Enable GitHub Issue Creation in project settings and ensure GitHub is connected.
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {previewQuery.isLoading ? 'Previewing ticket key…' : previewQuery.data?.key ? `Preview: ${previewQuery.data.key}` : null}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!values.title.trim() || !columnId || submitting}>
                        {submitting && values.createGithubIssue && canCreateGithubIssue ? 'Creating GitHub issue…' : 'Create Ticket'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleCreateAndEnhance}
                        disabled={!values.title.trim() || !columnId || submitting}
                    >
                        {submitting && values.createGithubIssue && canCreateGithubIssue ? 'Creating GitHub issue…' : 'Create & Enhance'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
