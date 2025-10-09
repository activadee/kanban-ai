export type CardFormValues = {
    title: string
    description: string
    dependsOn?: string[]
}

export type BaseDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

