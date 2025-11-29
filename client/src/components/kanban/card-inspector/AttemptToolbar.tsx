import {useMemo, useState} from "react";
import {Button} from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {Code2, GithubIcon} from "lucide-react";
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
                               }: AttemptToolbarProps) {
    if (!attempt) return null;
    const hasTodos = !!todoSummary && todoSummary.total > 0;

    return (
        <div className="flex items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                onClick={onOpenEditor}
                disabled={!!openButtonDisabledReason}
                title={openButtonDisabledReason ?? undefined}
            >
                <Code2 className="mr-2 size-4"/> Open editor
            </Button>
            {hasTodos && todoSummary ? (
                <TodoPanel summary={todoSummary}/>
            ) : null}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                        <GithubIcon/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                    <DropdownMenuItem onClick={onOpenChanges}>
                        View Changes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenCommit}>Commit…</DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenPr}>Create PR…</DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenMerge}>Merge</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function TodoPanel({summary}: { summary: AttemptTodoSummary }) {
    const [open, setOpen] = useState(false);
    const {total, completed} = summary;
    const label = `${completed}/${total} Todos`;

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
                    aria-label={`${completed} of ${total} Todos completed`}
                >
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm p-4">
                <DialogHeader>
                    <DialogTitle className="text-sm font-medium">Todos</DialogTitle>
                    <p className="text-xs text-muted-foreground">
                        {completed} of {total} Todos completed
                    </p>
                </DialogHeader>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {items.map((todo) => (
                        <div key={todo.id} className="flex items-start gap-2">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "mt-1 h-2 w-2 rounded-full",
                                    todo.status === "done" ? "bg-emerald-500" : "bg-muted-foreground/50",
                                )}
                            />
                            <p
                                className={cn(
                                    "text-xs",
                                    todo.status === "done" ? "text-muted-foreground line-through" : "",
                                )}
                            >
                                {todo.text}
                            </p>
                        </div>
                    ))}
                    {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No todos.</p>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
