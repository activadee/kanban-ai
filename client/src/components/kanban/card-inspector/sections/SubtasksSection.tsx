import {useMemo, useState} from 'react'
import type {Subtask, SubtaskStatus} from 'shared'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks, subtaskKeys} from '@/hooks'
import {useQueryClient} from '@tanstack/react-query'
import {toast} from '@/components/ui/toast'
import {describeApiError} from '@/api/http'
import {ArrowDown, ArrowUp, Plus, Trash2} from 'lucide-react'

type Props = {
    projectId: string
    ticketId: string
    locked?: boolean
}

type StatusOption = {
    value: SubtaskStatus
    label: string
}

const STATUS_OPTIONS: StatusOption[] = [
    {value: 'todo', label: 'To do'},
    {value: 'in_progress', label: 'In progress'},
    {value: 'blocked', label: 'Blocked'},
    {value: 'done', label: 'Done'},
]

function nextToggleStatus(current: SubtaskStatus): SubtaskStatus {
    return current === 'done' ? 'todo' : 'done'
}

export function SubtasksSection({projectId, ticketId, locked}: Props) {
    const queryClient = useQueryClient()
    const [newTitle, setNewTitle] = useState('')

    const subtasksQuery = useSubtasks(projectId, ticketId)
    const createMutation = useCreateSubtask({
        onSuccess: (data) => {
            queryClient.setQueryData(subtaskKeys.ticket(projectId, ticketId), data)
            setNewTitle('')
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Failed to create subtask')
            toast({title, description, variant: 'destructive'})
        },
    })
    const updateMutation = useUpdateSubtask({
        onSuccess: (data) => {
            queryClient.setQueryData(subtaskKeys.ticket(projectId, ticketId), data)
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Failed to update subtask')
            toast({title, description, variant: 'destructive'})
        },
    })
    const deleteMutation = useDeleteSubtask({
        onSuccess: (data) => {
            queryClient.setQueryData(subtaskKeys.ticket(projectId, ticketId), data)
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Failed to delete subtask')
            toast({title, description, variant: 'destructive'})
        },
    })
    const reorderMutation = useReorderSubtasks({
        onSuccess: (data) => {
            queryClient.setQueryData(subtaskKeys.ticket(projectId, ticketId), data)
        },
        onError: (err) => {
            const {title, description} = describeApiError(err, 'Failed to reorder subtasks')
            toast({title, description, variant: 'destructive'})
        },
    })

    const subtasks: Subtask[] = subtasksQuery.data?.subtasks ?? []
    const progress = subtasksQuery.data?.progress
    const total = progress?.total ?? 0
    const done = progress?.done ?? 0

    const canEdit = !locked

    const handleCreate = async () => {
        const title = newTitle.trim()
        if (!title || !canEdit || createMutation.isPending) return
        await createMutation.mutateAsync({
            projectId,
            ticketId,
            input: {title},
        })
    }

    const handleToggleStatus = async (subtask: Subtask) => {
        if (!canEdit || updateMutation.isPending) return
        await updateMutation.mutateAsync({
            projectId,
            subtaskId: subtask.id,
            input: {status: nextToggleStatus(subtask.status)},
        })
    }

    const handleTitleBlur = async (subtask: Subtask, value: string) => {
        const trimmed = value.trim()
        if (!canEdit || !trimmed || trimmed === subtask.title) return
        await updateMutation.mutateAsync({
            projectId,
            subtaskId: subtask.id,
            input: {title: trimmed},
        })
    }

    const handleStatusChange = async (subtask: Subtask, value: SubtaskStatus) => {
        if (!canEdit || value === subtask.status) return
        await updateMutation.mutateAsync({
            projectId,
            subtaskId: subtask.id,
            input: {status: value},
        })
    }

    const handleDelete = async (subtask: Subtask) => {
        if (!canEdit || deleteMutation.isPending) return
        await deleteMutation.mutateAsync({projectId, subtaskId: subtask.id})
    }

    const handleMove = async (subtask: Subtask, direction: 'up' | 'down') => {
        if (!canEdit || reorderMutation.isPending || subtasks.length < 2) return
        const index = subtasks.findIndex((s) => s.id === subtask.id)
        if (index === -1) return
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= subtasks.length) return

        const orderedIds = [...subtasks.map((s) => s.id)]
        const [removed] = orderedIds.splice(index, 1)
        orderedIds.splice(targetIndex, 0, removed)

        await reorderMutation.mutateAsync({
            projectId,
            ticketId,
            input: {orderedIds},
        })
    }

    const statusById = useMemo(
        () => new Map(subtasks.map((s) => [s.id, s.status])),
        [subtasks],
    )

    return (
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/5 p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">Subtasks</div>
                {total > 0 && (
                    <div className="text-xs text-muted-foreground">
                        {done} of {total} done
                    </div>
                )}
            </div>
            {subtasksQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Loading subtasks…</div>
            )}
            {!subtasksQuery.isLoading && subtasks.length === 0 && (
                <div className="text-xs text-muted-foreground">No subtasks yet.</div>
            )}
            {subtasks.length > 0 && (
                <div className="space-y-2">
                    {subtasks.map((subtask) => {
                        const status = statusById.get(subtask.id) ?? subtask.status
                        const isDone = status === 'done'
                        return (
                            <div
                                key={subtask.id}
                                className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5"
                            >
                                <Checkbox
                                    checked={isDone}
                                    onCheckedChange={() => handleToggleStatus(subtask)}
                                    disabled={!canEdit}
                                    className="mt-0.5"
                                />
                                <div className="flex flex-1 flex-col gap-1">
                                    <Input
                                        defaultValue={subtask.title}
                                        disabled={!canEdit}
                                        className="h-7 text-xs"
                                        onBlur={(e) => handleTitleBlur(subtask, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur()
                                            }
                                        }}
                                    />
                                    <Select
                                        defaultValue={status}
                                        disabled={!canEdit}
                                        onValueChange={(value) =>
                                            handleStatusChange(subtask, value as SubtaskStatus)
                                        }
                                    >
                                        <SelectTrigger className="h-7 w-40 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={!canEdit}
                                        onClick={() => handleMove(subtask, 'up')}
                                    >
                                        <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={!canEdit}
                                        onClick={() => handleMove(subtask, 'down')}
                                    >
                                        <ArrowDown className="h-3 w-3" />
                                    </Button>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    disabled={!canEdit}
                                    onClick={() => handleDelete(subtask)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )
                    })}
                </div>
            )}
            <div className="flex items-center gap-2 pt-1">
                <Input
                    placeholder="Add a subtask…"
                    value={newTitle}
                    disabled={!canEdit || createMutation.isPending}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            void handleCreate()
                        }
                    }}
                    className="h-8 text-xs"
                />
                <Button
                    size="icon"
                    className="h-8 w-8"
                    disabled={!canEdit || !newTitle.trim() || createMutation.isPending}
                    onClick={() => void handleCreate()}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

