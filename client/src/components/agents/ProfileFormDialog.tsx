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
import {Separator} from '@/components/ui/separator'
import {useAgentSchema} from '@/hooks'
import type {AgentProfileRow} from 'shared'
import {Settings2, Loader2, Pencil, Plus, Hash, ToggleLeft, Type, List, ChevronDown} from 'lucide-react'

const NONE_VALUE = '__none__'

interface ProfileFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    agentKey: string
    profile?: AgentProfileRow | null
    onSave: (data: {name: string; config: unknown}) => Promise<void>
    isSaving?: boolean
}

function groupFields(fields: Array<{key: string; label: string; type: string; optional?: boolean; options?: string[]}>) {
    const groups: {
        identity: typeof fields
        prompts: typeof fields
        behavior: typeof fields
        other: typeof fields
    } = {
        identity: [],
        prompts: [],
        behavior: [],
        other: [],
    }

    for (const field of fields) {
        const key = field.key.toLowerCase()
        if (key.includes('prompt') || key.includes('profile') || key === 'inlineprofile') {
            groups.prompts.push(field)
        } else if (field.type === 'boolean') {
            groups.behavior.push(field)
        } else if (key.includes('model') || key.includes('name') || key.includes('key')) {
            groups.identity.push(field)
        } else {
            groups.other.push(field)
        }
    }

    return groups
}

function getFieldIcon(type: string) {
    switch (type) {
        case 'number':
            return Hash
        case 'boolean':
            return ToggleLeft
        case 'enum':
            return ChevronDown
        case 'string_array':
            return List
        default:
            return Type
    }
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

    const fieldGroups = schemaQuery.data ? groupFields(schemaQuery.data.fields) : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                <div className={`relative px-6 pt-6 pb-5 ${
                    isEdit 
                        ? 'bg-gradient-to-br from-amber-500/5 via-transparent to-transparent' 
                        : 'bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent'
                }`}>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] to-transparent" />
                    <DialogHeader className="relative">
                        <div className="flex items-center gap-3">
                            <div className={`flex size-10 items-center justify-center rounded-xl ring-1 ${
                                isEdit 
                                    ? 'bg-amber-500/10 ring-amber-500/20' 
                                    : 'bg-emerald-500/10 ring-emerald-500/20'
                            }`}>
                                {isEdit ? (
                                    <Pencil className={`size-5 ${isEdit ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                ) : (
                                    <Plus className="size-5 text-emerald-600 dark:text-emerald-400" />
                                )}
                            </div>
                            <div>
                                <DialogTitle className="text-lg">
                                    {isEdit ? 'Edit Profile' : 'Create Profile'}
                                </DialogTitle>
                                <DialogDescription className="text-xs mt-0.5">
                                    {isEdit
                                        ? `Modify settings for "${profile?.name}"`
                                        : `New profile for ${agentKey}`}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="px-6 py-5 max-h-[calc(85vh-180px)] overflow-y-auto space-y-6">
                        <div className="space-y-2">
                            <Label 
                                htmlFor="profile-name" 
                                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                            >
                                Profile Name
                            </Label>
                            <div className="relative">
                                <Input
                                    id="profile-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. DEFAULT, fast, thorough..."
                                    autoFocus
                                    className="h-12 text-base font-medium bg-muted/30 border-muted-foreground/10 focus:bg-background transition-colors"
                                />
                                <Settings2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
                            </div>
                            <p className="text-[10px] text-muted-foreground/70">
                                Give your profile a memorable name to identify it later
                            </p>
                        </div>

                        <Separator className="bg-border/50" />

                        {!schemaQuery.data ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-3">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                                    <div className="relative flex size-12 items-center justify-center rounded-full bg-muted/50 ring-1 ring-border">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">Loading configuration schema...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {fieldGroups && fieldGroups.identity.length > 0 && (
                                    <FieldSection title="Configuration" fields={fieldGroups.identity} formValues={formValues} updateField={updateField} />
                                )}

                                {fieldGroups && fieldGroups.prompts.length > 0 && (
                                    <FieldSection title="Prompts & Instructions" fields={fieldGroups.prompts} formValues={formValues} updateField={updateField} />
                                )}

                                {fieldGroups && fieldGroups.behavior.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <ToggleLeft className="size-3.5 text-muted-foreground/60" />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Behavior
                                            </span>
                                        </div>
                                        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                                            {fieldGroups.behavior.map((field) => (
                                                <BooleanField
                                                    key={field.key}
                                                    field={field}
                                                    value={formValues[field.key]}
                                                    onChange={(v) => updateField(field.key, v)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {fieldGroups && fieldGroups.other.length > 0 && (
                                    <FieldSection title="Additional Settings" fields={fieldGroups.other} formValues={formValues} updateField={updateField} />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border/50 bg-muted/20 px-6 py-4">
                        <DialogFooter className="gap-2 sm:gap-3">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => onOpenChange(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={!name.trim() || isSaving}
                                className={`min-w-[140px] ${
                                    isEdit 
                                        ? 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700' 
                                        : ''
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : isEdit ? (
                                    <>
                                        <Pencil className="mr-2 size-4" />
                                        Save Changes
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 size-4" />
                                        Create Profile
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function FieldSection({
    title,
    fields,
    formValues,
    updateField,
}: {
    title: string
    fields: Array<{key: string; label: string; type: string; optional?: boolean; options?: string[]}>
    formValues: Record<string, unknown>
    updateField: (key: string, value: unknown) => void
}) {
    const Icon = getFieldIcon(fields[0]?.type || 'string')
    
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Icon className="size-3.5 text-muted-foreground/60" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                </span>
            </div>
            <div className="space-y-4">
                {fields.map((field) => (
                    <FieldRenderer
                        key={field.key}
                        field={field}
                        value={formValues[field.key]}
                        onChange={(v) => updateField(field.key, v)}
                    />
                ))}
            </div>
        </div>
    )
}

function FieldRenderer({
    field,
    value,
    onChange,
}: {
    field: {key: string; label: string; type: string; optional?: boolean; options?: string[]}
    value: unknown
    onChange: (value: unknown) => void
}) {
    switch (field.type) {
        case 'string': {
            const isTextarea = field.key === 'appendPrompt' || field.key === 'inlineProfile'
            
            if (isTextarea) {
                return (
                    <div className="space-y-2">
                        <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                            {field.label}
                            {field.optional && <span className="ml-1 text-muted-foreground/50 normal-case tracking-normal">(optional)</span>}
                        </Label>
                        <Textarea
                            rows={4}
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={field.key === 'appendPrompt' ? 'Additional instructions to append to the agent prompt...' : 'Custom inline profile prompt...'}
                            className="min-h-[100px] resize-y bg-muted/20 border-muted-foreground/10 focus:bg-background transition-colors text-sm font-mono"
                        />
                        {field.key === 'inlineProfile' && (
                            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                                Optional prompt used only for inline responses. If empty, the main profile is used.
                            </p>
                        )}
                    </div>
                )
            }
            
            return (
                <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {field.label}
                        {field.optional && <span className="ml-1 text-muted-foreground/50 normal-case tracking-normal">(optional)</span>}
                    </Label>
                    <Input
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => onChange(e.target.value || (field.optional ? undefined : ''))}
                        className="bg-muted/20 border-muted-foreground/10 focus:bg-background transition-colors"
                    />
                </div>
            )
        }

        case 'number':
            return (
                <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {field.label}
                        {field.optional && <span className="ml-1 text-muted-foreground/50 normal-case tracking-normal">(optional)</span>}
                    </Label>
                    <Input
                        type="number"
                        value={typeof value === 'number' ? value : ''}
                        onChange={(e) => {
                            const numValue = e.target.value
                                ? parseInt(e.target.value, 10)
                                : field.optional
                                  ? undefined
                                  : 0
                            onChange(numValue)
                        }}
                        className="bg-muted/20 border-muted-foreground/10 focus:bg-background transition-colors font-mono"
                    />
                </div>
            )

        case 'boolean':
            return <BooleanField field={field} value={value} onChange={onChange} />

        case 'enum':
            return (
                <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {field.label}
                        {field.optional && <span className="ml-1 text-muted-foreground/50 normal-case tracking-normal">(optional)</span>}
                    </Label>
                    <Select
                        value={typeof value === 'string' && value ? value : NONE_VALUE}
                        onValueChange={(v) => onChange(v === NONE_VALUE ? undefined : v)}
                    >
                        <SelectTrigger className="w-full bg-muted/20 border-muted-foreground/10 focus:bg-background transition-colors">
                            <SelectValue placeholder="Select an option..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {field.optional && (
                                <SelectItem value={NONE_VALUE} className="text-muted-foreground">
                                    None
                                </SelectItem>
                            )}
                            {field.options?.map((opt) => (
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
                <div className="space-y-2">
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {field.label}
                        {field.optional && <span className="ml-1 text-muted-foreground/50 normal-case tracking-normal">(optional)</span>}
                    </Label>
                    <Textarea
                        rows={3}
                        value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
                        onChange={(e) =>
                            onChange(e.target.value ? e.target.value.split(/\r?\n/).filter(Boolean) : [])
                        }
                        placeholder="One item per line..."
                        className="min-h-[80px] resize-y bg-muted/20 border-muted-foreground/10 focus:bg-background transition-colors text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground/60">
                        Enter one item per line
                    </p>
                </div>
            )

        default:
            return null
    }
}

function BooleanField({
    field,
    value,
    onChange,
}: {
    field: {key: string; label: string; optional?: boolean}
    value: unknown
    onChange: (value: unknown) => void
}) {
    return (
        <div className="flex items-center gap-3 py-1.5 px-1 rounded-md hover:bg-muted/30 transition-colors -mx-1">
            <Checkbox
                id={`pf-${field.key}`}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange(checked)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label 
                htmlFor={`pf-${field.key}`} 
                className="cursor-pointer text-sm font-normal flex-1 leading-tight"
            >
                {field.label}
            </Label>
        </div>
    )
}
