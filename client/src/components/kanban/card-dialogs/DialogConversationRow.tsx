import type {ConversationItem} from 'shared'

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
        return (
            <div
                className="mb-2 rounded border border-dashed border-border/50 bg-muted/20 p-2 text-xs text-muted-foreground">
                <div className="mb-1 flex items-center justify-between">
                    <span>thinking{item.title ? ` · ${item.title}` : ''}</span>
                    <span>{time}</span>
                </div>
                <div className="whitespace-pre-wrap">{item.text}</div>
            </div>
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

