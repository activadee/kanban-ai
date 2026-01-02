import {useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {Code2, GithubIcon, Layers, ScrollText, MoreHorizontal, CheckCircle2} from "lucide-react";
import {cn} from "@/lib/utils";
import type {Attempt, AttemptTodoSummary} from "shared";

type AttemptToolbarProps = {
    attempt: Attempt | null;
    openButtonDisabledReason: string | null;
    onOpenEditor: () => void;
    onOpenChanges: () => void;
    onOpenCommit: () => void;
    onOpenPr: () => void;
    onOpenMerge: () => void;
    todoSummary?: AttemptTodoSummary | null;
    onOpenProcesses?: () => void;
    onOpenLogs?: () => void;
};

export function AttemptToolbar({
    attempt,
    openButtonDisabledReason,
    onOpenEditor,
    onOpenChanges,
    onOpenCommit,
    onOpenPr,
    onOpenMerge,
    todoSummary,
    onOpenProcesses,
    onOpenLogs,
}: AttemptToolbarProps) {
    if (!attempt) return null;
    const hasTodos = !!todoSummary && todoSummary.total > 0;

    return (
        <div className="flex items-center gap-1.5">
            <Button
                size="sm"
                variant="outline"
                onClick={onOpenEditor}
                disabled={!!openButtonDisabledReason}
                title={openButtonDisabledReason ?? "Open in editor"}
                className="h-7 gap-1.5 text-xs"
            >
                <Code2 className="size-3.5" />
                <span className="hidden sm:inline">Editor</span>
            </Button>
            
            {hasTodos && todoSummary && (
                <TodoPanel summary={todoSummary} />
            )}
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                        <GithubIcon className="size-3.5" />
                        <span className="hidden sm:inline">Git</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={onOpenChanges}>
                        View Changes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenCommit}>
                        Commit...
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenPr}>
                        Create PR...
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenMerge}>
                        Merge
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    {onOpenProcesses && (
                        <DropdownMenuItem onClick={onOpenProcesses}>
                            <Layers className="size-3.5 mr-2" />
                            Processes
                        </DropdownMenuItem>
                    )}
                    {onOpenLogs && (
                        <DropdownMenuItem onClick={onOpenLogs}>
                            <ScrollText className="size-3.5 mr-2" />
                            Logs
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function TodoPanel({summary}: {summary: AttemptTodoSummary}) {
    const [open, setOpen] = useState(false);
    const {total, completed} = summary;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    const items = useMemo(() => {
        const list = Array.isArray(summary.items) ? summary.items : [];
        return [...list].sort((a, b) => {
            if (a.status === b.status) return 0;
            return a.status === "done" ? 1 : -1;
        });
    }, [summary]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs relative overflow-hidden"
                    aria-label={`${completed} of ${total} Todos completed`}
                >
                    <div 
                        className="absolute inset-0 bg-emerald-500/10 transition-all duration-300"
                        style={{width: `${progress}%`}}
                    />
                    <CheckCircle2 className="size-3.5 relative z-10" />
                    <span className="relative z-10">{completed}/{total}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm p-4">
                <DialogHeader>
                    <DialogTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle2 className="size-4" />
                        Todos
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {completed} of {total} completed
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {items.map((todo) => (
                        <div key={todo.id} className="flex items-start gap-2.5 group">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "mt-1.5 h-2 w-2 rounded-full shrink-0 transition-colors",
                                    todo.status === "done" 
                                        ? "bg-emerald-500" 
                                        : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                                )}
                            />
                            <p
                                className={cn(
                                    "text-xs leading-relaxed",
                                    todo.status === "done" && "text-muted-foreground line-through",
                                )}
                            >
                                {todo.text}
                            </p>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No todos yet.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
