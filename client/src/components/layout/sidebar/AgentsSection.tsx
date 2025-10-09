import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {ChevronDown, ChevronRight, Bot} from 'lucide-react'

export function AgentsSection({agents}: { agents: Array<{ key: string; label: string }> }) {
    const navigate = useNavigate()
    const [open, setOpen] = useState(true)
    return (
        <div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen((p) => !p)}
                    aria-expanded={open}
                    className="flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                    {open ? <ChevronDown className="size-4"/> : <ChevronRight className="size-4"/>}
                    <span className="flex-1 text-left">Agents</span>
                </button>
            </div>
            {open ? (
                <div className="mt-2 space-y-1 pr-1">
                    {agents.length === 0 ? (
                        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">No agents</div>
                    ) : (
                        agents.map((a) => (
                            <button
                                key={a.key}
                                type="button"
                                onClick={() => navigate(`/agents/${a.key}`)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/70"
                                title={`Manage ${a.label}`}
                            >
                                <Bot className="size-4"/>
                                <span className="flex-1 truncate text-left">{a.label}</span>
                            </button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    )
}

