import {useState, useCallback, useMemo} from 'react'
import {useQuery} from '@tanstack/react-query'
import {
    Terminal as TerminalIcon,
    Plus,
    FolderGit2,
    CircleDot,
    AlertCircle,
} from 'lucide-react'
import {TerminalPanel} from './TerminalPanel'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Badge} from '@/components/ui/badge'
import {ScrollArea} from '@/components/ui/scroll-area'
import {MasterDetailLayout, type MasterDetailItem} from '@/components/layout/MasterDetailLayout'
import {getEligibleCards, closeTerminal} from '@/api/terminals'
import type {EligibleTerminalCard} from 'shared'
import {cn} from '@/lib/utils'
import {toast} from '@/components/ui/toast'

export interface TerminalsToolWindowProps {
    projectId: string
    className?: string
}

interface OpenTerminal {
    cardId: string
    title: string
}

interface TerminalItem extends MasterDetailItem {
    cardId: string
    worktreePath: string
    hasActiveTerminal: boolean
    isOpen: boolean
}

export function TerminalsToolWindow({projectId, className}: TerminalsToolWindowProps) {
    const [openTerminals, setOpenTerminals] = useState<OpenTerminal[]>([])

    const {data: eligibleData, refetch, isLoading} = useQuery({
        queryKey: ['terminals', 'eligible', projectId],
        queryFn: () => getEligibleCards(projectId),
        refetchInterval: 5000,
    })

    const eligible = eligibleData?.eligible ?? []

    const openTerminal = useCallback((card: EligibleTerminalCard) => {
        const alreadyOpen = openTerminals.some((t) => t.cardId === card.cardId)
        if (alreadyOpen) return

        const title = card.worktreePath.split('/').pop() ?? card.cardId
        setOpenTerminals((prev) => [...prev, {cardId: card.cardId, title}])
    }, [openTerminals])

    const handleCloseTerminal = useCallback(async (cardId: string) => {
        try {
            await closeTerminal(cardId)
        } catch (err) {
            toast({
                title: 'Failed to close terminal',
                description: err instanceof Error ? err.message : 'The terminal session may still be active on the server.',
                variant: 'destructive',
            })
        }
        setOpenTerminals((prev) => prev.filter((t) => t.cardId !== cardId))
        refetch()
    }, [refetch])

    const handleSelectItem = useCallback((id: string) => {
        const card = eligible.find((c) => c.cardId === id)
        if (card) {
            openTerminal(card)
        }
    }, [eligible, openTerminal])

    const items: TerminalItem[] = useMemo(() => {
        return eligible.map((card) => {
            const worktreeName = card.worktreePath.split('/').pop() ?? card.cardId
            const isOpen = openTerminals.some((t) => t.cardId === card.cardId)
            return {
                id: card.cardId,
                cardId: card.cardId,
                label: worktreeName,
                subtitle: card.hasActiveTerminal ? 'Connected' : 'Ready',
                icon: TerminalIcon,
                worktreePath: card.worktreePath,
                hasActiveTerminal: card.hasActiveTerminal,
                isOpen,
                disabled: isOpen,
            }
        })
    }, [eligible, openTerminals])

    const availableCards = eligible.filter(
        (card) => !openTerminals.some((t) => t.cardId === card.cardId)
    )

    const hasNoWorkstations = eligible.length === 0 && openTerminals.length === 0
    const hasOpenTerminals = openTerminals.length > 0

    const renderTerminalItem = (item: TerminalItem, _isActive: boolean) => {
        return (
            <button
                onClick={() => !item.isOpen && handleSelectItem(item.id)}
                disabled={item.isOpen}
                className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150',
                    item.isOpen
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
            >
                <span
                    className={cn(
                        'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
                        'transition-all duration-200 ease-out',
                        item.isOpen
                            ? 'bg-sidebar-primary opacity-100'
                            : 'bg-transparent opacity-0 group-hover:bg-muted-foreground/30 group-hover:opacity-100'
                    )}
                />
                <span
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        'transition-all duration-150 ease-out',
                        item.isOpen
                            ? 'bg-sidebar-primary/10 text-sidebar-primary'
                            : 'bg-transparent text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-foreground'
                    )}
                >
                    <TerminalIcon className="size-[18px]" strokeWidth={item.isOpen ? 2 : 1.75} />
                </span>
                <span className="min-w-0 flex-1">
                    <span
                        className={cn(
                            'block truncate font-mono text-[13px] leading-tight',
                            item.isOpen ? 'font-medium' : 'font-normal'
                        )}
                    >
                        {item.label}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                        {item.hasActiveTerminal ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                                <CircleDot className="size-2.5 animate-pulse" />
                                Connected
                            </span>
                        ) : (
                            <span className="text-[10px] text-muted-foreground/60">
                                Ready
                            </span>
                        )}
                    </span>
                </span>
                {!item.isOpen && (
                    <Plus className="size-4 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
                {item.isOpen && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                        Open
                    </Badge>
                )}
            </button>
        )
    }

    const sidebarFooter = availableCards.length > 0 ? (
        <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Quick Launch
            </p>
            <div className="flex flex-wrap gap-1.5">
                {availableCards.slice(0, 3).map((card) => (
                    <Button
                        key={card.cardId}
                        variant="outline"
                        size="sm"
                        onClick={() => openTerminal(card)}
                        className="h-7 gap-1 px-2 text-[11px]"
                    >
                        <Plus className="size-3" />
                        <span className="max-w-[80px] truncate font-mono">
                            {card.worktreePath.split('/').pop()}
                        </span>
                    </Button>
                ))}
            </div>
        </div>
    ) : null

    const emptyState = (
        <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30">
                <FolderGit2 className="size-5 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                    No worktrees active
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                    Move cards to In Progress or Review to enable terminal sessions.
                </p>
            </div>
        </div>
    )

    return (
        <MasterDetailLayout<TerminalItem>
            title="Workstations"
            items={items}
            activeId={null}
            onSelect={handleSelectItem}
            loading={isLoading}
            emptyState={emptyState}
            renderItem={renderTerminalItem}
            sidebarFooter={sidebarFooter}
            sidebarClassName={className}
        >
            {hasNoWorkstations ? (
                <div className="flex h-full items-center justify-center p-8">
                    <Card className="w-full max-w-md border-border/50 bg-card/60">
                        <CardHeader className="pb-4 text-center">
                            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/20">
                                <AlertCircle className="size-6 text-muted-foreground/70" />
                            </div>
                            <CardTitle className="text-base">No Active Worktrees</CardTitle>
                            <CardDescription className="text-xs">
                                Terminal sessions require cards with active worktrees in the In Progress or Review columns.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-6">
                            <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                                Move a card to start working, and the worktree will be created automatically.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : !hasOpenTerminals ? (
                <div className="flex h-full items-center justify-center p-8">
                    <div className="relative flex max-w-sm flex-col items-center gap-5 text-center">
                        <div className="absolute -inset-16 -z-10 rounded-full bg-gradient-to-br from-muted/30 via-transparent to-brand/5 blur-3xl" />
                        
                        <div className="relative">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-border/30 to-transparent blur-lg" />
                            <div className="relative flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-lg shadow-black/5">
                                <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.015)_50%)] bg-[length:100%_4px]" />
                                <TerminalIcon className="size-7 text-muted-foreground/70" strokeWidth={1.5} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-base font-semibold tracking-tight text-foreground">
                                Select a Workstation
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Choose a worktree from the sidebar to open a terminal session.
                            </p>
                        </div>

                        {availableCards.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openTerminal(availableCards[0])}
                                className="mt-2 gap-2"
                            >
                                <Plus className="size-3.5" />
                                Open {availableCards[0].worktreePath.split('/').pop()}
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <ScrollArea className="h-full">
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
                        {openTerminals.map((terminal) => (
                            <TerminalPanel
                                key={terminal.cardId}
                                cardId={terminal.cardId}
                                projectId={projectId}
                                title={terminal.title}
                                onClose={() => handleCloseTerminal(terminal.cardId)}
                                className="h-[350px]"
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}
        </MasterDetailLayout>
    )
}
