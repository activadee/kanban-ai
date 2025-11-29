export type SubtaskId = string;

export type SubtaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface Subtask {
    id: SubtaskId;
    /**
     * Parent ticket identifier. In practice this is the card ID on the board.
     */
    ticketId: string;
    title: string;
    description?: string | null;
    status: SubtaskStatus;
    /**
     * Zero-based position for ordering within the parent ticket.
     */
    position: number;
    assigneeId?: string | null;
    /**
     * Optional due date (ISO 8601 string) or null when not set.
     */
    dueDate?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SubtaskProgress {
    total: number;
    done: number;
}

export interface SubtaskListResponse {
    ticketId: string;
    subtasks: Subtask[];
    progress: SubtaskProgress;
}

export interface CreateSubtaskRequest {
    title: string;
    description?: string | null;
    status?: SubtaskStatus;
    assigneeId?: string | null;
    dueDate?: string | null;
}

export interface UpdateSubtaskRequest {
    title?: string;
    description?: string | null;
    status?: SubtaskStatus;
    assigneeId?: string | null;
    dueDate?: string | null;
}

export interface ReorderSubtasksRequest {
    orderedIds: SubtaskId[];
}

