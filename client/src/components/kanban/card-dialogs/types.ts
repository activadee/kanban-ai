import type {TicketType} from 'shared'

export type CardFormValues = {
    title: string
    description: string
    dependsOn?: string[]
    ticketType?: TicketType | null
}

export type BaseDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}
