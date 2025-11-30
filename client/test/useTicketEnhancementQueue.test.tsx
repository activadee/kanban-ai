import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useTicketEnhancementQueue } from "@/hooks/tickets";
import { toast } from "@/components/ui/toast";

const STORAGE_KEY = "kanbanai:ticket-enhancements";
const ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

vi.mock("@/lib/env", () => ({
    SERVER_URL: "http://test-server/api/v1",
}));

vi.mock("@/components/ui/toast", () => ({
    toast: vi.fn(),
}));

function TestComponent(props: {
    projectId?: string;
    onReady: (queue: ReturnType<typeof useTicketEnhancementQueue>) => void;
}) {
    const queue = useTicketEnhancementQueue(props.projectId ?? "proj-1");

    React.useEffect(() => {
        props.onReady(queue);
    }, [queue, props]);

    return null;
}

describe("useTicketEnhancementQueue", () => {
    beforeEach(() => {
        cleanup();
        vi.restoreAllMocks();
        localStorage.clear();

        // Re-establish mocked modules after restoreAllMocks
        vi.mocked(toast).mockClear();
    });

    it("starts enhancement for a new card and stores suggestion", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    ticket: {
                        title: "Enhanced Title",
                        description: "Enhanced Description",
                    },
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );

        const fetchSpy = vi
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .spyOn(global as any, "fetch")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .mockImplementation(fetchMock as any);

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue).toBeDefined();
        });

        await queue!.startEnhancementForNewCard({
            projectId: "proj-1",
            cardId: "card-1",
            title: "Original Title",
            description: "Original Description",
        });

        await waitFor(() => {
            expect(queue!.enhancements["card-1"]?.status).toBe("ready");
        });

        const entry = queue!.enhancements["card-1"];
        expect(entry?.suggestion).toEqual({
            title: "Enhanced Title",
            description: "Enhanced Description",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            "http://test-server/api/v1/projects/proj-1/tickets/enhance",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "Original Title",
                    description: "Original Description",
                    agent: undefined,
                    profileId: undefined,
                }),
            },
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("hydrates enhancements from localStorage on mount", async () => {
        const persisted = {
            "proj-1:card-1": {
                status: "ready",
                suggestion: {
                    title: "Saved title",
                    description: "Saved description",
                },
                updatedAt: Date.now(),
            },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue?.enhancements["card-1"]?.status).toBe("ready");
        });

        expect(queue!.enhancements["card-1"]?.suggestion).toEqual({
            title: "Saved title",
            description: "Saved description",
        });
    });

    it("persists enhancement updates to localStorage", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    ticket: {
                        title: "Enhanced Title",
                        description: "Enhanced Description",
                    },
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );

        vi.spyOn(global as any, "fetch").mockImplementation(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fetchMock as any,
        );

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue).toBeDefined();
        });

        await queue!.startEnhancementForExistingCard({
            projectId: "proj-1",
            cardId: "card-3",
            title: "Title",
            description: "Description",
        });

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
            expect(stored["proj-1:card-3"]?.status).toBe("ready");
        });
    });

    it("clears persisted enhancement on clearEnhancement", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    ticket: { title: "T", description: "D" },
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );

        vi.spyOn(global as any, "fetch").mockImplementation(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fetchMock as any,
        );

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue).toBeDefined();
        });

        await queue!.startEnhancementForExistingCard({
            projectId: "proj-1",
            cardId: "card-4",
            title: "Title",
            description: "Description",
        });

        await waitFor(() => {
            expect(queue!.enhancements["card-4"]?.status).toBe("ready");
        });

        queue!.clearEnhancement("card-4");

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
            expect(stored["proj-1:card-4"]).toBeUndefined();
            expect(queue!.enhancements["card-4"]).toBeUndefined();
        });
    });

    it("ignores malformed localStorage content", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        localStorage.setItem(STORAGE_KEY, "not-json");

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue?.enhancements).toEqual({});
        });

        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        warnSpy.mockRestore();
    });

    it("drops expired enhancement entries", async () => {
        const expired = Date.now() - ENTRY_TTL_MS * 2;
        const persisted = {
            "proj-1:stale-card": {
                status: "ready",
                suggestion: { title: "Old", description: "Old" },
                updatedAt: expired,
            },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue?.enhancements).toEqual({});
        });

        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("clears state and shows a toast on enhancement failure", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: "fail" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }),
        );

        vi.spyOn(global as any, "fetch").mockImplementation(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fetchMock as any,
        );

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue).toBeDefined();
        });

        await queue!.startEnhancementForExistingCard({
            projectId: "proj-1",
            cardId: "card-2",
            title: "Broken Title",
            description: "Broken Description",
        });

        await waitFor(() => {
            expect(queue!.enhancements["card-2"]).toBeUndefined();
        });

        expect(toast).toHaveBeenCalled();
    });
});
