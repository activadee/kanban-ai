import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
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
import type { CardFormValues, BaseDialogProps } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TicketType } from "shared";
import { ticketTypeOptions } from "@/lib/ticketTypes";

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

    useEffect(() => {
        if (open) {
            setValues({
                title: cardTitle,
                description: cardDescription ?? "",
                ticketType: cardTicketType ?? null,
            });
            setHasAutoEnhanced(false);
        }
    }, [open, cardTitle, cardDescription, cardTicketType]);

    const handleEnhanceInBackground = async () => {
        if (!values.title.trim()) return;
        try {
            setSaving(true);
            const payload: CardFormValues = {
                title: values.title.trim(),
                description: values.description.trim(),
                dependsOn: values.dependsOn ?? [],
                ticketType: values.ticketType ?? null,
            };
            await onSubmit(payload);
            if (onEnhanceInBackground) {
                await onEnhanceInBackground(payload);
            }
            onOpenChange(false);
        } finally {
            setSaving(false);
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
                        />
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
