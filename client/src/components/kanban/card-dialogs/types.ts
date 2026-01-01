import type {TicketType, MessageImage} from 'shared'

export type CardFormValues = {
    title: string
    description: string
    dependsOn?: string[]
    ticketType?: TicketType | null
    createGithubIssue?: boolean
    images?: MessageImage[]
}

export type BaseDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}
