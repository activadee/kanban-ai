import {useState} from 'react'
import type {ConversationItem} from 'shared'
import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import {Button} from '@/components/ui/button'
import {decodeBase64Stream} from '@/lib/encoding'
import {CollapsibleThinkingBlock} from '@/components/kanban/conversation/CollapsibleThinkingBlock'
import {ImageAttachment} from '@/components/ui/image-attachment'

export function MessageRow({item}: { item: ConversationItem }) {
    const timestamp = Number.isNaN(Date.parse(item.timestamp)) ? new Date() : new Date(item.timestamp)
    const time = timestamp.toLocaleTimeString()
    const [revealOutput, setRevealOutput] = useState(false)

    switch (item.type) {
        case 'message': {
            const {role, text, images} = item
            const badgeVariant: 'default' | 'secondary' | 'outline' = role === 'assistant' ? 'secondary' : role === 'user' ? 'default' : 'outline'
            return (
                <div className="mb-2 rounded bg-background p-2">
                    <div className="mb-1 flex items-center gap-2">
                        <Badge className="text-[10px]" variant={badgeVariant}>{role}</Badge>
                        <span className="text-xs text-muted-foreground">{time}</span>
                        {item.profileId ?
                            <span className="text-xs text-muted-foreground">profile: {item.profileId}</span> : null}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{text}</div>
                    {images && images.length > 0 ? (
                        <ImageAttachment images={images} variant="badge" size="sm" className="mt-2" />
                    ) : null}
                </div>
            )
        }
        case 'thinking': {
            const firstLine = item.text.split('\n')[0]?.trim()
            const summaryLabel = item.title?.trim() || firstLine || 'thinking'
            const ariaLabel = item.title ? `thinking · ${item.title}` : 'thinking'
            return (
                <CollapsibleThinkingBlock
                    ariaLabel={ariaLabel}
                    headerLeft={(
                        <>
                            <Badge className="text-[10px]" variant="outline">thinking</Badge>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{summaryLabel}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                        </>
                    )}
                    text={item.text}
                />
            )
        }
        case 'tool': {
            const {tool} = item
            const statusVariant: 'default' | 'secondary' | 'outline' = 'outline'
            const statusClass = tool.status === 'succeeded'
                ? 'border-emerald-500 text-emerald-500'
                : tool.status === 'failed'
                    ? 'border-destructive/40 text-destructive'
                    : undefined
            const summaryLabel = tool.name || 'tool'
            return (
                <details className="mb-2 rounded border border-border/60 bg-background p-2">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Badge className="text-[10px]" variant="outline">tool</Badge>
                            <Badge className={cn('text-[10px]', statusClass)}
                                   variant={statusVariant}>{tool.status}</Badge>
                            <span className="text-xs font-medium">{summaryLabel}</span>
                            <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Toggle</span>
                    </summary>
                    <div className="mt-2 space-y-2 text-xs">
                        {tool.command ? (
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground">command</div>
                                <div className="rounded bg-muted px-2 py-1 font-mono text-xs">{tool.command}</div>
                            </div>
                        ) : null}
                        {tool.cwd ? (
                            <div className="text-muted-foreground">cwd: <span className="font-mono">{tool.cwd}</span>
                            </div>
                        ) : null}
                        {typeof tool.exitCode === 'number' ? (
                            <div className="text-muted-foreground">exit code: {tool.exitCode}</div>
                        ) : null}
                        {(tool.stdout || tool.stderr) ? (
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] uppercase text-muted-foreground">output</div>
                                <Button size="sm" variant="outline" onClick={() => setRevealOutput((v) => !v)}>
                                    {revealOutput ? 'Hide output' : 'Reveal output'}
                                </Button>
                            </div>
                        ) : null}
                        {revealOutput && tool.stdout ? (
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground">stdout</div>
                                <pre
                                    className="max-w-full overflow-auto whitespace-pre break-words rounded bg-muted px-2 py-1 text-xs">{decodeBase64Stream(tool.stdout)}</pre>
                            </div>
                        ) : null}
                        {revealOutput && tool.stderr ? (
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground">stderr</div>
                                <pre
                                    className="max-w-full overflow-auto whitespace-pre break-words rounded bg-muted px-2 py-1 text-xs">{decodeBase64Stream(tool.stderr)}</pre>
                            </div>
                        ) : null}
                    </div>
                </details>
            )
        }
        case 'automation': {
            const stageLabels: Record<typeof item.stage, string> = {
                copy_files: 'Copy files',
                setup: 'Setup',
                dev: 'Dev',
                cleanup: 'Cleanup',
            }
            const statusClass = item.status === 'succeeded'
                ? 'border-emerald-500 text-emerald-500'
                : item.status === 'failed'
                    ? 'border-destructive/40 text-destructive'
                    : undefined
            return (
                <details className="mb-2 rounded border border-border/60 bg-background p-2" open>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className="text-[10px]" variant="outline">automation</Badge>
                            <Badge className="text-[10px]" variant="outline">{stageLabels[item.stage]}</Badge>
                            <Badge className={cn('text-[10px]', statusClass)} variant="outline">{item.status}</Badge>
                            <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Toggle</span>
                    </summary>
                    <div className="mt-2 space-y-2 text-xs">
                        <div>
                            <div className="text-[10px] uppercase text-muted-foreground">command</div>
                            <div className="rounded bg-muted px-2 py-1 font-mono text-xs">{item.command}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                            <span>cwd: <span className="font-mono text-foreground">{item.cwd}</span></span>
                            <span>exit code: {item.exitCode ?? 'n/a'}</span>
                            <span>duration: {Number.isFinite(item.durationMs)
                                ? `${(item.durationMs / 1000).toFixed(1)}s`
                                : 'n/a'}</span>
                        </div>
                        {(item.stdout || item.stderr) ? (
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] uppercase text-muted-foreground">output</div>
                                <Button size="sm" variant="outline" onClick={() => setRevealOutput((v) => !v)}>
                                    {revealOutput ? 'Hide output' : 'Reveal output'}
                                </Button>
                            </div>
                        ) : null}
                        {revealOutput && item.stdout ? (
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground">stdout</div>
                                <pre
                                    className="max-w-full overflow-auto whitespace-pre break-words rounded bg-muted px-2 py-1 text-xs">{item.stdout}</pre>
                            </div>
                        ) : null}
                        {revealOutput && item.stderr ? (
                            <div>
                                <div className="text-[10px] uppercase text-muted-foreground">stderr</div>
                                <pre
                                    className="max-w-full overflow-auto whitespace-pre break-words rounded bg-muted px-2 py-1 text-xs">{item.stderr}</pre>
                            </div>
                        ) : null}
                    </div>
                </details>
            )
        }
        case 'error': {
            return (
                <div className="mb-2 rounded border border-destructive/40 bg-destructive/10 p-2">
                    <div className="mb-1 flex items-center gap-2">
                        <Badge className="text-[10px] border-destructive bg-destructive/10 text-destructive"
                               variant="outline">error</Badge>
                        <span className="text-xs text-muted-foreground">{time}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-destructive">{item.text}</div>
                </div>
            )
        }
        default:
            return null
    }
}
