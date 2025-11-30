import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {useAppVersion} from '@/hooks'

type Props = {
    className?: string
}

export function VersionIndicator({className}: Props) {
    const version = useAppVersion()

    if (version.isLoading) {
        return <span className={cn('text-xs text-muted-foreground', className)}>Checking version…</span>
    }

    if (version.isError || !version.data) {
        return <span className={cn('text-xs text-muted-foreground', className)}>Version unavailable</span>
    }

    const {currentVersion, updateAvailable} = version.data
    const label = currentVersion ? `v${currentVersion}` : 'Version'

    if (!updateAvailable) {
        return <span className={cn('text-xs text-muted-foreground', className)}>{label}</span>
    }

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <span className="text-xs text-muted-foreground">{label}</span>
            <Badge
                variant="secondary"
                className="border-amber-200 bg-amber-100 text-[11px] font-semibold leading-tight text-amber-950 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-50"
                role="status"
                aria-label="Update available. Restart KanbanAI to update."
            >
                Update available — restart to apply
            </Badge>
        </div>
    )
}
