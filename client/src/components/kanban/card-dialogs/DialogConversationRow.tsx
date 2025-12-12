import type {ConversationItem} from 'shared'
import {CollapsibleThinkingBlock} from '@/components/kanban/conversation/CollapsibleThinkingBlock'

export function DialogConversationRow({item}: { item: ConversationItem }) {
    const timestamp = Number.isNaN(Date.parse(item.timestamp)) ? new Date() : new Date(item.timestamp)
    const time = timestamp.toLocaleTimeString()

    if (item.type === 'message') {
        return (
            <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="uppercase text-[10px]">{item.role}</span>
                    <span>{time}</span>
                </div>
                <div className="whitespace-pre-wrap">{item.text}</div>
            </div>
        )
    }

    if (item.type === 'thinking') {
        const firstLine = item.text.split('\n')[0]?.trim()
        const summaryLabel = item.title?.trim() || firstLine || 'thinking'
        const ariaLabel = item.title ? `thinking · ${item.title}` : 'thinking'
        return (
            <CollapsibleThinkingBlock
                ariaLabel={ariaLabel}
                className="text-xs"
                headerLeft={
                    <>
                        <span className="text-[10px] uppercase text-muted-foreground">thinking</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{summaryLabel}</span>
                        <span className="text-xs text-muted-foreground">{time}</span>
                    </>
                }
                contentClassName="text-xs text-muted-foreground"
                text={item.text}
            />
        )
    }

    if (item.type === 'tool') {
        return (
            <div className="mb-2 rounded border border-border/60 bg-background p-2 text-xs">
                <div className="mb-1 flex items-center justify-between text-muted-foreground">
          <span className={item.tool.status === 'succeeded' ? 'text-emerald-500 font-medium' : undefined}>
            {item.tool.name} · {item.tool.status}
          </span>
                    <span>{time}</span>
                </div>
                {item.tool.command ? <div className="font-mono">{item.tool.command}</div> : null}
                {item.tool.stderr ?
                    <pre className="mt-1 whitespace-pre-wrap text-destructive">{item.tool.stderr}</pre> : null}
            </div>
        )
    }

    if (item.type === 'automation') {
        const stageLabels: Record<typeof item.stage, string> = {
            copy_files: 'Copy files',
            setup: 'Setup',
            dev: 'Dev',
            cleanup: 'Cleanup',
        }
        const isAllowedFailure =
            item.status === 'failed' && item.allowedFailure === true
        const statusClass = item.status === 'succeeded'
            ? 'text-emerald-500'
            : isAllowedFailure
                ? 'text-amber-500'
                : item.status === 'failed'
                    ? 'text-destructive'
                    : undefined
        const statusLabel = isAllowedFailure ? 'warning' : item.status
        return (
            <div className="mb-2 rounded border border-border/60 bg-background p-2 text-xs">
                <div className="mb-1 flex items-center justify-between text-muted-foreground">
                    <span className={statusClass}>{stageLabels[item.stage]} · {statusLabel}</span>
                    <span>{time}</span>
                </div>
                <div className="space-y-1 text-muted-foreground">
                    <div className="font-mono text-foreground">{item.command}</div>
                    <div>cwd: <span className="font-mono text-foreground">{item.cwd}</span></div>
                    <div>exit: {item.exitCode ?? 'n/a'} · duration: {(item.durationMs / 1000).toFixed(1)}s</div>
                    {item.stdout ?
                        <pre className="whitespace-pre-wrap text-foreground">{item.stdout}</pre> : null}
                    {item.stderr ?
                        <pre className="whitespace-pre-wrap text-destructive">{item.stderr}</pre> : null}
                </div>
            </div>
        )
    }

    if (item.type === 'error') {
        return (
            <div className="mb-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <div className="mb-1 flex items-center justify-between">
                    <span>error</span>
                    <span>{time}</span>
                </div>
                <div className="whitespace-pre-wrap">{item.text}</div>
            </div>
        )
    }

    return null
}
