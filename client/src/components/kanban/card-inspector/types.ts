import type {ComponentProps, ReactNode} from 'react'
import type {Button} from '@/components/ui/button'
import type {Attempt} from 'shared'

export type ProcessStatus = Attempt['status'] | 'idle'
export type ProcessActionVariant = ComponentProps<typeof Button>['variant']

export type ProcessAction = {
    id: string
    label: string
    onClick: () => void | Promise<void>
    disabled?: boolean
    variant?: ProcessActionVariant
    tooltip?: string
}

export type ProcessEntry = {
    id: string
    icon: ReactNode
    name: string
    status: ProcessStatus
    description?: ReactNode
    meta?: ReactNode
    actions?: ProcessAction[]
}

