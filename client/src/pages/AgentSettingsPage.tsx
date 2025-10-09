import {useMemo, useState} from 'react'
import {useParams} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {agentKeys} from '@/lib/queryClient'
import {
    useAgentProfiles,
    useAgentSchema,
    useCreateAgentProfile,
    useUpdateAgentProfile,
    useDeleteAgentProfile,
} from '@/hooks'
import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'

export function AgentSettingsPage() {
    const params = useParams<{ agentKey: string }>()
    const agentKey = params.agentKey ?? ''
    const qc = useQueryClient()
    const [activeId, setActiveId] = useState<string | null>(null)
    const [name, setName] = useState('DEFAULT')
    const [formValues, setFormValues] = useState<Record<string, unknown>>({})

    const schemaQuery = useAgentSchema(agentKey, {enabled: Boolean(agentKey)})
    const profilesQuery = useAgentProfiles('global', {enabled: Boolean(agentKey)})

    const profiles = useMemo(() => (profilesQuery.data ?? []).filter((p) => p.agent === agentKey), [profilesQuery.data, agentKey])

    const createMutation = useCreateAgentProfile({
        onSuccess: async () => {
            await qc.invalidateQueries({queryKey: agentKeys.profiles('global')})
            resetToDefault()
        },
    })
    const updateMutation = useUpdateAgentProfile({
        onSuccess: async () => {
            await qc.invalidateQueries({queryKey: agentKeys.profiles('global')})
        },
    })
    const deleteMutation = useDeleteAgentProfile({
        onSuccess: async () => {
            await qc.invalidateQueries({queryKey: agentKeys.profiles('global')})
            resetToDefault()
        },
    })

    function resetToDefault() {
        setActiveId(null)
        setName('DEFAULT')
        if (schemaQuery.data) setFormValues(schemaQuery.data.defaultProfile as Record<string, unknown>)
    }

    function updateField(key: string, value: unknown) {
        setFormValues((prev) => ({...prev, [key]: value}))
    }

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            <div>
                <h1 className="text-lg font-semibold">{agentKey} Profiles</h1>
                <p className="text-sm text-muted-foreground">Create, edit, and delete profiles for this agent.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-[280px_1fr]">
                <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Existing profiles</div>
                    <div className="space-y-1">
                        {profiles.length === 0 ? (
                            <div className="rounded border bg-muted/20 p-2 text-sm text-muted-foreground">No profiles
                                yet.</div>
                        ) : (
                            profiles.map((p) => (
                                <button
                                    key={p.id}
                                    className={`w-full rounded border px-3 py-2 text-left ${activeId === p.id ? 'bg-muted' : ''}`}
                                    onClick={() => {
                                        setActiveId(p.id)
                                        setName(p.name)
                                        try {
                                            setFormValues(JSON.parse(p.configJson as unknown as string))
                                        } catch {
                                            setFormValues({})
                                        }
                                    }}
                                >
                                    <div className="text-sm font-medium">{p.name}</div>
                                </button>
                            ))
                        )}
                    </div>
                    {activeId ? (
                        <Button
                            className="mt-2"
                            variant="destructive"
                            size="sm"
                            onClick={() => activeId && deleteMutation.mutate({profileId: activeId})}
                            disabled={deleteMutation.isPending}
                        >
                            Delete
                        </Button>
                    ) : null}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label>Profile name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="DEFAULT"
                                   className="w-64"/>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={resetToDefault}>New</Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (activeId) {
                                        updateMutation.mutate({
                                            profileId: activeId,
                                            payload: {name, config: formValues}
                                        })
                                    } else {
                                        createMutation.mutate({agent: agentKey, name, config: formValues})
                                    }
                                }}
                                disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
                            >
                                {activeId ? (updateMutation.isPending ? 'Saving…' : 'Save') : (createMutation.isPending ? 'Creating…' : 'Create')}
                            </Button>
                        </div>
                    </div>

                    {!schemaQuery.data ? (
                        <div className="text-sm text-muted-foreground">Loading schema…</div>
                    ) : (
                        <div className="space-y-3">
                            {schemaQuery.data.fields.map((field) => {
                                const val = formValues[field.key]
                                switch (field.type) {
                                    case 'string':
                                        return (
                                            <div key={field.key} className="space-y-1">
                                                <Label>{field.label}</Label>
                                                <Input value={typeof val === 'string' ? val : ''}
                                                       onChange={(e) => updateField(field.key, e.target.value)}/>
                                            </div>
                                        )
                                    case 'boolean':
                                        return (
                                            <label key={field.key} className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={Boolean(val)}
                                                       onChange={(e) => updateField(field.key, e.target.checked)}/>
                                                {field.label}
                                            </label>
                                        )
                                    case 'enum':
                                        return (
                                            <div key={field.key} className="space-y-1">
                                                <Label>{field.label}</Label>
                                                <Select value={typeof val === 'string' ? val : ''}
                                                        onValueChange={(v) => updateField(field.key, v)}>
                                                    <SelectTrigger className="w-64"><SelectValue placeholder="Select…"/></SelectTrigger>
                                                    <SelectContent className="max-h-60 overflow-y-auto">
                                                        {field.options.map((opt) => (
                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )
                                    case 'string_array':
                                        return (
                                            <div key={field.key} className="space-y-1">
                                                <Label>{field.label}</Label>
                                                <Textarea rows={3}
                                                          value={Array.isArray(val) ? (val as string[]).join('\n') : ''}
                                                          onChange={(e) => updateField(field.key, e.target.value ? e.target.value.split(/\r?\n/).filter(Boolean) : [])}/>
                                            </div>
                                        )
                                    default:
                                        return null
                                }
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
