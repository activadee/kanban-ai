import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'
import {Badge} from '@/components/ui/badge'
import {Hash, ArrowRight} from 'lucide-react'

export function TicketNumberingForm({
    ticketPrefix,
    nextTicketNumber,
    onPrefixChange,
}: {
    ticketPrefix: string
    nextTicketNumber: number
    onPrefixChange: (value: string) => void
}) {
    const normalize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
    const previewId = ticketPrefix ? `${ticketPrefix}-${String(nextTicketNumber).padStart(3, '0')}` : 'PRJ-001'
    const nextPreviewId = ticketPrefix ? `${ticketPrefix}-${String(nextTicketNumber + 1).padStart(3, '0')}` : 'PRJ-002'

    return (
        <div className="space-y-5">
            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                <div className="relative p-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Hash className="h-3.5 w-3.5" />
                        <span>Live Preview</span>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="flex flex-col items-center">
                            <span className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">Current</span>
                            <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-2.5 font-mono text-lg font-semibold tracking-tight text-foreground shadow-sm">
                                {previewId}
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                        <div className="flex flex-col items-center">
                            <span className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">Next</span>
                            <div className="rounded-md border border-border/40 bg-muted/30 px-4 py-2.5 font-mono text-lg tracking-tight text-muted-foreground">
                                {nextPreviewId}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="group space-y-2.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="ticket-prefix" className="text-sm font-medium">
                            Ticket Prefix
                        </Label>
                        <Badge variant="outline" className="h-5 border-dashed px-1.5 text-[10px] font-normal">
                            1-6 chars
                        </Badge>
                    </div>
                    <Input
                        id="ticket-prefix"
                        value={ticketPrefix}
                        onChange={(e) => onPrefixChange(normalize(e.target.value))}
                        placeholder="KAN"
                        maxLength={6}
                        className="h-10 font-mono text-sm uppercase tracking-wide transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Alphanumeric characters only. Changes apply to new tickets.
                    </p>
                </div>

                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="next-ticket-number" className="text-sm font-medium">
                            Next Number
                        </Label>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                            Auto
                        </Badge>
                    </div>
                    <div className="relative">
                        <Input
                            id="next-ticket-number"
                            value={nextTicketNumber.toString()}
                            readOnly
                            disabled
                            className="h-10 bg-muted/40 pr-10 font-mono text-sm tabular-nums text-muted-foreground"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500/60" />
                        </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Increments automatically when tickets are created.
                    </p>
                </div>
            </div>
        </div>
    )
}
