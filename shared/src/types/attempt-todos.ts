export type AttemptTodoStatus = "open" | "done";

export type AttemptTodoItem = {
    id: string;
    text: string;
    status: AttemptTodoStatus;
};

export type AttemptTodoSummary = {
    total: number;
    completed: number;
    items: AttemptTodoItem[];
};

