import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { CardFormValues, BaseDialogProps } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TicketType } from "shared";
import { ticketTypeOptions } from "@/lib/ticketTypes";
import { useImagePaste } from "@/hooks";

type EditProps = BaseDialogProps & {
    cardTitle: string;
    cardDescription?: string | null;
    cardTicketKey?: string | null;
    cardTicketType?: TicketType | null;
    onSubmit: (values: CardFormValues) => Promise<void> | void;
    onDelete: () => Promise<void> | void;
    projectId: string;
    cardId?: string;
    onEnhanceInBackground?: (values: CardFormValues) => Promise<void> | void;
    /**
     * When true, automatically triggers the "Enhance in background"
     * flow once on open using the current title/description.
     */
    autoEnhanceOnOpen?: boolean;
};

export function EditCardDialog({
    open,
    onOpenChange,
    cardTitle,
    cardDescription,
    cardTicketKey,
    cardTicketType,
    onSubmit,
    onDelete,
    onEnhanceInBackground,
    autoEnhanceOnOpen = false,
}: EditProps) {
    const initialTicketType = cardTicketType ?? null;

    const [values, setValues] = useState<CardFormValues>({
        title: cardTitle,
        description: cardDescription ?? "",
        ticketType: initialTicketType,
    });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [hasAutoEnhanced, setHasAutoEnhanced] = useState(false);
    const {pendingImages, addImagesFromClipboard, addImagesFromDataTransfer, removeImage, clearImages, canAddMore} = useImagePaste();

    useEffect(() => {
        if (open) {
            setValues({
                title: cardTitle,
                description: cardDescription ?? "",
                ticketType: cardTicketType ?? null,
            });
            setHasAutoEnhanced(false);
            clearImages();
        }
    }, [open, cardTitle, cardDescription, cardTicketType, clearImages]);

    const handleEnhanceInBackground = async () => {
        if (!values.title.trim()) return;
        try {
            setSaving(true);
            const payload: CardFormValues = {
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn ?? [],
                ticketType: values.ticketType ?? null,
                images: pendingImages.length > 0 ? pendingImages : undefined,
            };
            await onSubmit(payload);
            if (onEnhanceInBackground) {
                await onEnhanceInBackground(payload);
            }
            onOpenChange(false);
            clearImages();
        } finally {
            setSaving(false);
        }
    };

    const handleDescriptionPaste = async (e: React.ClipboardEvent) => {
        if (!canAddMore) return;
        const clipboardEvent = e.nativeEvent as ClipboardEvent;
        const errors = await addImagesFromClipboard(clipboardEvent);
        if (errors.length > 0) {
            toast({title: 'Image error', description: errors[0].message, variant: 'destructive'});
        }
    };

    const handleDescriptionDrop = async (e: React.DragEvent) => {
        if (!canAddMore) return;
        e.preventDefault();
        const errors = await addImagesFromDataTransfer(e.dataTransfer);
        if (errors.length > 0) {
            toast({title: 'Image error', description: errors[0].message, variant: 'destructive'});
        }
    };

    useEffect(() => {
        if (!open || !autoEnhanceOnOpen || hasAutoEnhanced) return;
        if (!values.title.trim()) return;
        void handleEnhanceInBackground();
        setHasAutoEnhanced(true);
    }, [open, autoEnhanceOnOpen, hasAutoEnhanced, values.title]);

    const handleSave = async () => {
        if (!values.title.trim()) return;
        try {
            setSaving(true);
            await onSubmit({
                title: values.title.trim(),
                description: values.description.trim(),
                ticketType: values.ticketType ?? null,
            });
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Delete this ticket?")) return;
        try {
            setDeleting(true);
            await onDelete();
            onOpenChange(false);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Ticket</DialogTitle>
                    <DialogDescription>
                        Update the ticket details or delete it.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-card-title">Title</Label>
                        <Input
                            id="edit-card-title"
                            value={values.title}
                            onChange={(event) =>
                                setValues((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-card-description">
                            Description
                        </Label>
                        <Textarea
                            id="edit-card-description"
                            rows={4}
                            value={values.description}
                            onChange={(event) =>
                                setValues((prev) => ({
                                    ...prev,
                                    description: event.target.value,
                                }))
                            }
                            onPaste={handleDescriptionPaste}
                            onDrop={handleDescriptionDrop}
                            onDragOver={(e) => e.preventDefault()}
                            placeholder={canAddMore ? "Describe the task... (paste or drop images here)" : "Describe the task..."}
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
                                {pendingImages.length} image{pendingImages.length !== 1 ? "s" : ""} attached (sent with &quot;Enhance in background&quot;)
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-card-type">Type</Label>
                        <Select
                            value={(values.ticketType ?? "none") as string}
                            onValueChange={(next) =>
                                setValues((prev) => ({
                                    ...prev,
                                    ticketType: next === "none" ? null : (next as TicketType),
                                }))
                            }
                        >
                            <SelectTrigger id="edit-card-type" className="w-full">
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
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleEnhanceInBackground}
                            disabled={!values.title.trim() || saving}
                        >
                            <Bot className="mr-1 size-4" /> Enhance in
                            background
                        </Button>
                    </div>
                    {cardTicketKey ? (
                        <div className="space-y-2">
                            <Label htmlFor="edit-card-ticket-key">
                                Ticket key
                            </Label>
                            <Input
                                id="edit-card-ticket-key"
                                value={cardTicketKey}
                                readOnly
                                disabled
                                className="bg-muted/30 text-foreground"
                            />
                        </div>
                    ) : null}
                </div>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting || saving}
                    >
                        Delete Ticket
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={saving || deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={
                                !values.title.trim() || saving || deleting
                            }
                        >
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
