import {useEffect, useMemo, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import type {AgentKey, Attempt, AttemptLog, ConversationItem} from 'shared'
import {attemptKeys, cardAttemptKeys} from '@/lib/queryClient'
import {useAgents, useCardAttempt, useAttemptLogs, useStartAttempt, useStopAttempt} from '@/hooks'
import {useAttemptEventStream} from '@/hooks/useAttemptEventStream'
import type {CardFormValues, BaseDialogProps} from './types'
import {DialogConversationRow} from './DialogConversationRow'

type EditProps = BaseDialogProps & {
    cardTitle: string
    cardDescription?: string | null
    cardTicketKey?: string | null
    onSubmit: (values: CardFormValues) => Promise<void> | void
    onDelete: () => Promise<void> | void
    projectId?: string
    cardId?: string
}

export function EditCardDialog({
                                   open,
                                   onOpenChange,
                                   cardTitle,
                                   cardDescription,
                                   cardTicketKey,
                                   onSubmit,
                                   onDelete,
                                   projectId,
                                   cardId
                               }: EditProps) {
    const [values, setValues] = useState<CardFormValues>({title: cardTitle, description: cardDescription ?? ''})
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [agent, setAgent] = useState<AgentKey>('')
    const [attempt, setAttempt] = useState<Attempt | null>(null)
    const [logs, setLogs] = useState<AttemptLog[]>([])
    const [conversation, setConversation] = useState<ConversationItem[]>([])
    const queryClient = useQueryClient()

    useEffect(() => {
        if (open) {
            setValues({title: cardTitle, description: cardDescription ?? ''})
        }
    }, [open, cardTitle, cardDescription])

    const agentsQuery = useAgents()
    const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data])

    useEffect(() => {
        if (open && agents.length && !agent) setAgent(agents[0].key)
    }, [open, agents, agent])

    const attemptDetailQuery = useCardAttempt(projectId, cardId, {enabled: Boolean(open && projectId && cardId)})
    const logsQuery = useAttemptLogs(attempt?.id, {enabled: Boolean(attempt?.id)})

    useEffect(() => {
        if (!attemptDetailQuery.data) return
        setAttempt(attemptDetailQuery.data.attempt)
        setConversation(attemptDetailQuery.data.conversation ?? [])
        setLogs(attemptDetailQuery.data.logs ?? [])
    }, [attemptDetailQuery.data])

    useEffect(() => {
        if (logsQuery.data) setLogs(logsQuery.data)
    }, [logsQuery.data])

    useAttemptEventStream({
        attemptId: attempt?.id,
        onStatus: (status) => {
            setAttempt((prev) => (prev ? {...prev, status} as Attempt : prev))
            if (attempt?.id) {
                queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId!, cardId!)})
            }
        },
        onLog: (p) => {
            if (!attempt?.id) return
            setLogs((prev) => [...prev, {
                id: crypto.randomUUID(),
                attemptId: attempt.id,
                ts: p.ts,
                level: p.level,
                message: p.message
            }])
            queryClient.invalidateQueries({queryKey: attemptKeys.logs(attempt.id)})
            queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId!, cardId!)})
        },
        onMessage: (item) => {
            if (!attempt?.id) return
            setConversation((prev) => {
                if (item.id && prev.some((m) => m.id === item.id)) return prev
                return [...prev, item]
            })
            queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId!, cardId!)})
        },
    })

    const handleSave = async () => {
        if (!values.title.trim()) return
        try {
            setSaving(true)
            await onSubmit({title: values.title.trim(), description: values.description.trim()})
            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Delete this ticket?')) return
        try {
            setDeleting(true)
            await onDelete()
            onOpenChange(false)
        } finally {
            setDeleting(false)
        }
    }

    const startMutation = useStartAttempt({
        onSuccess: async (att) => {
            setAttempt(att)
            setConversation([])
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId!, cardId!)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.logs(att.id)})
        },
    })

    const startAttempt = async () => {
        if (!projectId || !cardId) return
        try {
            await startMutation.mutateAsync({projectId, cardId, agent})
        } catch (err) {
            console.error('Start attempt failed', err)
        }
    }

    const stopMutation = useStopAttempt({
        onSuccess: async (_data, {attemptId}) => {
            await queryClient.invalidateQueries({queryKey: cardAttemptKeys.detail(projectId!, cardId!)})
            await queryClient.invalidateQueries({queryKey: attemptKeys.detail(attemptId)})
        },
    })

    const stopAttempt = async () => {
        if (!attempt) return
        try {
            await stopMutation.mutateAsync({attemptId: attempt.id})
        } catch (err) {
            console.error('Stop attempt failed', err)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Ticket</DialogTitle>
                    <DialogDescription>Update the ticket details or delete it.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-card-title">Title</Label>
                        <Input
                            id="edit-card-title"
                            value={values.title}
                            onChange={(event) => setValues((prev) => ({...prev, title: event.target.value}))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-card-description">Description</Label>
                        <Textarea
                            id="edit-card-description"
                            rows={4}
                            value={values.description}
                            onChange={(event) => setValues((prev) => ({...prev, description: event.target.value}))}
                        />
                    </div>
                    {cardTicketKey ? (
                        <div className="space-y-2">
                            <Label htmlFor="edit-card-ticket-key">Ticket key</Label>
                            <Input id="edit-card-ticket-key" value={cardTicketKey} readOnly disabled
                                   className="bg-muted/30 text-foreground"/>
                        </div>
                    ) : null}

                    {/* Agent controls + preview (compact) */}
                    <div className="rounded-md border border-border/60 p-3">
                        <div className="mb-2 text-xs text-muted-foreground">Attempt preview</div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-xs">Agent</Label>
                            <select
                                className="h-8 rounded border bg-background px-2 text-sm"
                                value={agent}
                                onChange={(e) => setAgent(e.target.value as AgentKey)}
                            >
                                {agents.map((a) => (
                                    <option key={a.key} value={a.key}>{a.label}</option>
                                ))}
                            </select>
                            <Button size="sm" onClick={startAttempt} disabled={!projectId || !cardId}>
                                Start
                            </Button>
                            {attempt ? (
                                <Button size="sm" variant="secondary" onClick={stopAttempt}>
                                    Stop
                                </Button>
                            ) : null}
                        </div>
                        {attempt && (
                            <div className="mt-2 space-y-2">
                                <div className="text-xs text-muted-foreground">Attempt {attempt.id} —
                                    Status: {attempt.status}</div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="h-40 overflow-auto rounded bg-muted/10 p-2 font-mono text-xs">
                                        <div className="mb-1 font-semibold">Logs</div>
                                        {logs.length === 0 ? (
                                            <div className="text-muted-foreground">No logs yet…</div>
                                        ) : (
                                            logs.map((l) => (
                                                <div key={l.id} className="whitespace-pre-wrap">
                                                    [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.message}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="h-40 overflow-auto rounded bg-muted/10 p-2 text-sm">
                                        <div className="mb-1 font-semibold">Conversation</div>
                                        {conversation.length === 0 ? (
                                            <div className="text-muted-foreground">No messages yet…</div>
                                        ) : (
                                            conversation.map((item, index) => (
                                                <DialogConversationRow key={item.id ?? `${item.timestamp}-${index}`}
                                                                       item={item}/>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting || saving}>
                        Delete Ticket
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!values.title.trim() || saving || deleting}>
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

