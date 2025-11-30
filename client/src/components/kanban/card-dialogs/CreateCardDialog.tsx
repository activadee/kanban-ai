import {useEffect, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {projectsKeys} from '@/lib/queryClient'
import {useNextTicketKey} from '@/hooks'
import {DependenciesPicker} from '@/components/kanban/DependenciesPicker'
import type {CardFormValues, BaseDialogProps} from './types'

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
    const [values, setValues] = useState<CardFormValues>({title: '', description: '', dependsOn: []})
    const [columnId, setColumnId] = useState<string>(defaultColumnId ?? columns[0]?.id ?? '')
    const [submitting, setSubmitting] = useState(false)
    const queryClient = useQueryClient()

    const previewQuery = useNextTicketKey(projectId, {
        enabled: open && Boolean(projectId),
        staleTime: 5_000,
    })

    useEffect(() => {
        if (!open) {
            setValues({title: '', description: '', dependsOn: []})
            setColumnId(defaultColumnId ?? columns[0]?.id ?? '')
        }
    }, [open, columns, defaultColumnId])

    const handleSubmit = async () => {
        if (!values.title.trim() || !columnId) return
        try {
            setSubmitting(true)
            await onSubmit(columnId, {
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn ?? [],
            })
            onOpenChange(false)
            setValues({title: '', description: '', dependsOn: []})
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
            })
            onOpenChange(false)
            setValues({title: '', description: '', dependsOn: []})
            setColumnId(defaultColumnId ?? columns[0]?.id ?? '')
            await queryClient.invalidateQueries({queryKey: projectsKeys.nextTicketKey(projectId)})
        } finally {
            setSubmitting(false)
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
                        />
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
                    <div className="text-xs text-muted-foreground">
                        {previewQuery.isLoading ? 'Previewing ticket key…' : previewQuery.data?.key ? `Preview: ${previewQuery.data.key}` : null}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!values.title.trim() || !columnId || submitting}>
                        Create Ticket
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleCreateAndEnhance}
                        disabled={!values.title.trim() || !columnId || submitting}
                    >
                        Create &amp; Enhance
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
