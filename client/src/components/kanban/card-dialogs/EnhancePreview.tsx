import {Button} from '@/components/ui/button'
import type {CardFormValues} from './types'

type EnhancePreviewProps = {
    original: CardFormValues
    enhanced: CardFormValues
    onAccept: () => void
    onReject: () => void
}

export function EnhancePreview({original, enhanced, onAccept, onReject}: EnhancePreviewProps) {
    return (
        <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    AI suggestion preview
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={onReject}>
                        Reject
                    </Button>
                    <Button size="sm" onClick={onAccept}>
                        Accept
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Original</div>
                    <div className="text-sm font-medium break-words">{original.title}</div>
                    <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {original.description || 'No description'}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">Suggestion</div>
                    <div className="text-sm font-medium break-words">{enhanced.title}</div>
                    <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {enhanced.description || 'No description'}
                    </div>
                </div>
            </div>
        </div>
    )
}

