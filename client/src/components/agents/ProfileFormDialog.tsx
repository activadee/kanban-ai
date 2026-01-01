import {useEffect, useState} from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Checkbox} from '@/components/ui/checkbox'
import {useAgentSchema} from '@/hooks'
import type {AgentProfileRow} from 'shared'

const NONE_VALUE = '__none__'

interface ProfileFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    agentKey: string
    profile?: AgentProfileRow | null
    onSave: (data: {name: string; config: unknown}) => Promise<void>
    isSaving?: boolean
}

export function ProfileFormDialog({
    open,
    onOpenChange,
    agentKey,
    profile,
    onSave,
    isSaving,
}: ProfileFormDialogProps) {
    const [name, setName] = useState('')
    const [formValues, setFormValues] = useState<Record<string, unknown>>({})

    const schemaQuery = useAgentSchema(agentKey, {enabled: open && Boolean(agentKey)})
    const isEdit = Boolean(profile)

    useEffect(() => {
        if (!open) return
        
        if (profile) {
            setName(profile.name)
            try {
                const cfg = JSON.parse(profile.configJson as unknown as string) as Record<string, unknown>
                setFormValues(cfg)
            } catch {
                setFormValues({})
            }
        } else if (schemaQuery.data) {
            setName('')
            setFormValues({...(schemaQuery.data.defaultProfile as Record<string, unknown>)})
        }
    }, [open, profile, schemaQuery.data])

    const updateField = (key: string, value: unknown) => {
        setFormValues((prev) => ({...prev, [key]: value}))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        await onSave({name: name.trim(), config: formValues})
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Edit Profile' : 'Create Profile'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `Modify the "${profile?.name}" profile for ${agentKey}`
                            : `Create a new profile for ${agentKey}`}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="profile-name">Profile Name</Label>
                        <Input
                            id="profile-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="DEFAULT"
                            autoFocus
                        />
                    </div>

                    {!schemaQuery.data ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading schema...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {schemaQuery.data.fields.map((field) => {
                                const value = formValues[field.key]

                                    switch (field.type) {
                                    case 'string': {
                                        if (field.key === 'appendPrompt' || field.key === 'inlineProfile') {
                                            return (
                                                <div key={field.key} className="space-y-2">
                                                    <Label>{field.label}</Label>
                                                    <Textarea
                                                        rows={4}
                                                        value={typeof value === 'string' ? value : ''}
                                                        onChange={(e) => updateField(field.key, e.target.value)}
                                                        placeholder={field.key === 'appendPrompt' ? 'Additional instructions...' : 'Inline profile prompt...'}
                                                    />
                                                    {field.key === 'inlineProfile' && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Optional prompt used only for inline responses. If empty, the main profile is used.
                                                        </p>
                                                    )}
                                                </div>
                                            )
                                        }
                                        return (
                                            <div key={field.key} className="space-y-2">
                                                <Label>{field.label}</Label>
                                                <Input
                                                    value={typeof value === 'string' ? value : ''}
                                                    onChange={(e) =>
                                                        updateField(field.key, e.target.value || (field.optional ? undefined : ''))
                                                    }
                                                />
                                            </div>
                                        )
                                    }

                                    case 'number':
                                        return (
                                            <div key={field.key} className="space-y-2">
                                                <Label>{field.label}</Label>
                                                <Input
                                                    type="number"
                                                    value={typeof value === 'number' ? value : ''}
                                                    onChange={(e) => {
                                                        const numValue = e.target.value
                                                            ? parseInt(e.target.value, 10)
                                                            : field.optional
                                                              ? undefined
                                                              : 0
                                                        updateField(field.key, numValue)
                                                    }}
                                                />
                                            </div>
                                        )

                                    case 'boolean':
                                        return (
                                            <div key={field.key} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`pf-${field.key}`}
                                                    checked={Boolean(value)}
                                                    onCheckedChange={(checked) => updateField(field.key, checked)}
                                                />
                                                <Label htmlFor={`pf-${field.key}`} className="cursor-pointer">
                                                    {field.label}
                                                </Label>
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
                                                        <SelectValue placeholder="Select..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60 overflow-y-auto">
                                                        {field.optional && (
                                                            <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                        )}
                                                        {field.options.map((opt) => (
                                                            <SelectItem key={opt} value={opt}>
                                                                {opt}
                                                            </SelectItem>
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
                                                    value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
                                                    onChange={(e) =>
                                                        updateField(
                                                            field.key,
                                                            e.target.value ? e.target.value.split(/\r?\n/).filter(Boolean) : []
                                                        )
                                                    }
                                                    placeholder="One item per line..."
                                                />
                                            </div>
                                        )

                                    default:
                                        return null
                                }
                            })}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim() || isSaving}>
                            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Profile'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
