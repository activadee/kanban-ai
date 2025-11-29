import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import type { ConversationItem } from "shared";

import { eventBus } from "@/lib/events";
import { useAttemptEventStream } from "@/hooks/useAttemptEventStream";

function TestStream({ attemptId }: { attemptId?: string | null }) {
    const [status, setStatus] = React.useState<string | null>(null);
    const [logs, setLogs] = React.useState<string[]>([]);
    const [sessionId, setSessionId] = React.useState<string | null>(null);
    const [todos, setTodos] = React.useState<string | null>(null);

    React.useEffect(() => {
        setStatus(null);
        setLogs([]);
        setSessionId(null);
        setTodos(null);
    }, [attemptId]);

    useAttemptEventStream({
        attemptId: attemptId ?? undefined,
        onStatus: (s) => setStatus(s),
        onLog: (log) => setLogs((prev) => [...prev, log.message]),
        onMessage: () => {},
        onSession: (id) => setSessionId(id),
        onTodos: (summary) =>
            setTodos(`${summary.completed}/${summary.total}`),
    });

    return (
        <div>
            <div data-testid="status">{status ?? ""}</div>
            <div data-testid="logs">{logs.join("|")}</div>
            <div data-testid="session">{sessionId ?? ""}</div>
            <div data-testid="todos">{todos ?? ""}</div>
        </div>
    );
}

describe("useAttemptEventStream", () => {
    beforeEach(() => {
        cleanup();
    });

    it("receives events for the active attempt id", () => {
        render(<TestStream attemptId="att-1" />);

        const item: ConversationItem = {
            type: "message",
            role: "assistant",
            text: "hello",
            timestamp: new Date().toISOString(),
        } as any;

        act(() => {
            eventBus.emit("attempt_status", {
                attemptId: "att-1",
                status: "running",
            });
            eventBus.emit("attempt_log", {
                attemptId: "att-1",
                level: "info",
                message: "log-1",
                ts: new Date().toISOString(),
            });
            eventBus.emit("attempt_session", {
                attemptId: "att-1",
                sessionId: "sess-1",
            });
            eventBus.emit("conversation_item", {
                attemptId: "att-1",
                item,
            });
            eventBus.emit("attempt_todos", {
                attemptId: "att-1",
                todos: {
                    total: 4,
                    completed: 2,
                    items: [],
                },
            } as any);
        });

        expect(screen.getByTestId("status").textContent).toBe("running");
        expect(screen.getByTestId("logs").textContent).toBe("log-1");
        expect(screen.getByTestId("session").textContent).toBe("sess-1");
        expect(screen.getByTestId("todos").textContent).toBe("2/4");
    });

    it("switches subscriptions when attempt id changes", () => {
        const { rerender } = render(<TestStream attemptId="att-1" />);

        act(() => {
            eventBus.emit("attempt_status", {
                attemptId: "att-1",
                status: "running",
            });
            eventBus.emit("attempt_todos", {
                attemptId: "att-1",
                todos: {
                    total: 3,
                    completed: 1,
                    items: [],
                },
            } as any);
        });

        expect(screen.getByTestId("status").textContent).toBe("running");
        expect(screen.getByTestId("todos").textContent).toBe("1/3");

        rerender(<TestStream attemptId="att-2" />);

        act(() => {
            eventBus.emit("attempt_status", {
                attemptId: "att-1",
                status: "failed",
            });
            eventBus.emit("attempt_status", {
                attemptId: "att-2",
                status: "queued",
            });
            eventBus.emit("attempt_todos", {
                attemptId: "att-2",
                todos: {
                    total: 2,
                    completed: 2,
                    items: [],
                },
            } as any);
        });

        expect(screen.getByTestId("status").textContent).toBe("queued");
        expect(screen.getByTestId("todos").textContent).toBe("2/2");
    });

    it("ignores events when attempt id is null", () => {
        render(<TestStream attemptId={null} />);

        act(() => {
            eventBus.emit("attempt_status", {
                attemptId: "att-1",
                status: "running",
            });
            eventBus.emit("attempt_todos", {
                attemptId: "att-1",
                todos: {
                    total: 1,
                    completed: 0,
                    items: [],
                },
            } as any);
        });

        expect(screen.getByTestId("status").textContent).toBe("");
        expect(screen.getByTestId("todos").textContent).toBe("");
    });
});
