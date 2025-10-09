import {Label} from '@/components/ui/label'
import {Input} from '@/components/ui/input'

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
    return (
        <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Ticket numbering</h3>
                <span className="text-xs text-muted-foreground">Prefixes apply to future tickets only.</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="ticket-prefix">Ticket prefix</Label>
                    <Input id="ticket-prefix" value={ticketPrefix}
                           onChange={(e) => onPrefixChange(normalize(e.target.value))} placeholder="KAN" maxLength={6}/>
                    <p className="text-xs text-muted-foreground">Use 1–6 uppercase letters or numbers. Example keys
                        appear as {ticketPrefix ? `${ticketPrefix}-001` : 'PRJ-001'}.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="next-ticket-number">Next ticket number</Label>
                    <Input id="next-ticket-number" value={nextTicketNumber.toString()} readOnly disabled
                           className="bg-muted/40 text-muted-foreground"/>
                    <p className="text-xs text-muted-foreground">Automatically increments when new tickets are
                        created.</p>
                </div>
            </div>
        </section>
    )
}

