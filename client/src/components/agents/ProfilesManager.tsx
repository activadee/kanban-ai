import {useEffect, useMemo, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {agentKeys} from '@/lib/queryClient'
import {
    useAgentProfiles,
    useAgentSchema,
    useCreateAgentProfile,
    useDeleteAgentProfile,
    useUpdateAgentProfile
} from '@/hooks'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'

const NONE_VALUE = '__none__'

export function ProfilesManager({open, onOpenChange, onChanged}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onChanged?: () => void
}) {
    const queryClient = useQueryClient()
    const [formValues, setFormValues] = useState<Record<string, unknown>>({})
    const [name, setName] = useState('DEFAULT')
    const [activeId, setActiveId] = useState<string | null>(null)

    const profilesQuery = useAgentProfiles('global', {enabled: open})

    const schemaQuery = useAgentSchema('CODEX', {enabled: open})

    useEffect(() => {
        if (schemaQuery.data) {
            setFormValues({...(schemaQuery.data.defaultProfile as Record<string, unknown>)})
        }
    }, [schemaQuery.data])

    const createMutation = useCreateAgentProfile({
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
            onChanged?.()
            if (schemaQuery.data) {
                setFormValues({...(schemaQuery.data.defaultProfile as Record<string, unknown>)})
            }
            setName('DEFAULT')
        },
    })

    const deleteMutation = useDeleteAgentProfile({
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
            onChanged?.()
            setActiveId(null)
        },
    })

    const updateMutation = useUpdateAgentProfile({
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: agentKeys.profiles('global')})
            onChanged?.()
        },
    })

    const updateField = (key: string, value: unknown) => {
        setFormValues((prev) => ({...prev, [key]: value}))
    }

    const remove = async (id: string) => {
        if (!confirm('Delete profile?')) return
        try {
            await deleteMutation.mutateAsync({profileId: id})
        } catch (err) {
            console.error('delete failed', err)
        }
    }

    const create = async () => {
        if (!schemaQuery.data) return
        try {
            await createMutation.mutateAsync({agent: 'CODEX', name, config: formValues})
        } catch (err) {
            console.error('create profile failed', err)
        }
    }

    const profiles = useMemo(() => (profilesQuery.data ?? []).filter((p) => p.agent === 'CODEX'), [profilesQuery.data])
    const loading = profilesQuery.isFetching
    const error = profilesQuery.isError ? profilesQuery.error : null
    const schema = schemaQuery.data ?? null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Manage Codex Profiles</DialogTitle>
                    <DialogDescription>Create variants and defaults for Codex without env vars.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Profile name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="DEFAULT"/>
                        </div>
                        {schema ? (
                            <div className="space-y-3">
                                {schema.fields.map((field) => {
                                    const value = formValues[field.key]
                                    switch (field.type) {
                                        case 'string':
                                            return (
                                                <div key={field.key} className="space-y-2">
                                                    <Label>{field.label}</Label>
                                                    <Input
                                                        value={typeof value === 'string' ? value : ''}
                                                        onChange={(e) => updateField(field.key, e.target.value || (field.optional ? undefined : ''))}
                                                    />
                                                </div>
                                            )
                                        case 'boolean':
                                            return (
                                                <div key={field.key} className="flex items-center gap-2">
                                                    <input
                                                        id={`pf-${field.key}`}
                                                        type="checkbox"
                                                        checked={Boolean(value)}
                                                        onChange={(e) => updateField(field.key, e.target.checked)}
                                                    />
                                                    <Label htmlFor={`pf-${field.key}`}>{field.label}</Label>
                                                </div>
                                            )
                                        case 'enum':
                                            return (
                                                <div key={field.key} className="space-y-2">
                                                    <Label>{field.label}</Label>
                                                    <Select
                                                        value={typeof value === 'string' && value ? value : NONE_VALUE}
                                                        onValueChange={(v) => updateField(field.key, v === NONE_VALUE ? undefined : v)}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select…"/>
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-60 overflow-y-auto">
                                                            {field.optional ? (
                                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                            ) : null}
                                                            {field.options.map((opt) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )
                                        case 'string_array':
                                            return (
                                                <div key={field.key} className="space-y-2">
                                                    <Label>{field.label}</Label>
                                                    <Textarea
                                                        rows={3}
                                                        value={Array.isArray(value) ? value.join('\n') : ''}
                                                        onChange={(e) => updateField(field.key, e.target.value ? e.target.value.split(/\r?\n/).filter(Boolean) : [])}
                                                    />
                                                </div>
                                            )
                                        default:
                                            return null
                                    }
                                })}
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={create}
                                            disabled={!name.trim() || createMutation.isPending}>
                                        {createMutation.isPending ? 'Saving…' : 'Create'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            if (!activeId) return
                                            updateMutation.mutate({
                                                profileId: activeId,
                                                payload: {name, config: formValues}
                                            })
                                        }}
                                        disabled={!activeId || updateMutation.isPending}
                                    >
                                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">Loading schema…</div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <div className="text-sm text-muted-foreground">Existing profiles</div>
                        {loading ? (
                            <div className="text-sm text-muted-foreground">Loading…</div>
                        ) : error ? (
                            <div
                                className="text-sm text-destructive">{error instanceof Error ? error.message : 'Failed to load profiles'}</div>
                        ) : profiles.length ? (
                            <div className="space-y-2">
                                {profiles.map((p) => (
                                    <button
                                        key={p.id}
                                        className={`flex w-full items-center justify-between rounded border p-2 text-left ${activeId === p.id ? 'bg-muted' : ''}`}
                                        onClick={() => {
                                            setActiveId(p.id)
                                            setName(p.name)
                                            try {
                                                const cfg = JSON.parse(p.configJson as unknown as string) as Record<string, unknown>
                                                setFormValues(cfg)
                                            } catch {
                                                setFormValues({})
                                            }
                                        }}
                                    >
                                        <div className="text-sm font-medium">{p.name}</div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="destructive" onClick={(e) => {
                                                e.stopPropagation();
                                                remove(p.id)
                                            }} disabled={deleteMutation.isPending}>
                                                Delete
                                            </Button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">No profiles yet.</div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
