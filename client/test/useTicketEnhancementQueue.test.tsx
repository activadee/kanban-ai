import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useTicketEnhancementQueue } from "@/hooks/tickets";
import { toast } from "@/components/ui/toast";

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

describe("useTicketEnhancementQueue (DB persistence)", () => {
    beforeEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.mocked(toast).mockClear();
    });

    it("hydrates enhancements from server on mount", async () => {
        const fetchMock = vi.fn(async (url) => {
            if (url.toString().endsWith("/projects/proj-1/enhancements")) {
                return new Response(
                    JSON.stringify({
                        enhancements: {
                            "card-1": {
                                status: "ready",
                                suggestion: { title: "Saved", description: "Saved desc" },
                            },
                        },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                );
            }
            throw new Error(`Unexpected fetch ${url}`);
        });

        vi.spyOn(global, "fetch" as any).mockImplementation(fetchMock as any);

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
            title: "Saved",
            description: "Saved desc",
        });
        expect(fetchMock.mock.calls[0]?.[0]).toBe("http://test-server/api/v1/projects/proj-1/enhancements");
    });

    it("persists enhancement lifecycle to the API", async () => {
        const fetchMock = vi.fn(async (url, options?: RequestInit) => {
            const href = url.toString();
            if (href.endsWith("/projects/proj-1/enhancements") && (!options || options.method === undefined)) {
                return new Response(JSON.stringify({ enhancements: {} }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (href.includes("/tickets/enhance")) {
                return new Response(
                    JSON.stringify({
                        ticket: { title: "Enhanced Title", description: "Enhanced Description" },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                );
            }
            if (href.includes("/enhancement") && options?.method === "PUT") {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            throw new Error(`Unexpected fetch ${href}`);
        });

        vi.spyOn(global, "fetch" as any).mockImplementation(fetchMock as any);

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

        await act(async () => {
            await queue!.startEnhancementForExistingCard({
                projectId: "proj-1",
                cardId: "card-3",
                title: "Title",
                description: "Description",
            });
        });

        await waitFor(() => {
            expect(queue!.enhancements["card-3"]?.status).toBe("ready");
        });

        const calls = fetchMock.mock.calls.map(([u, o]) => [u.toString(), o?.method]);
        expect(calls).toContainEqual(["http://test-server/api/v1/projects/proj-1/enhancements", undefined]);
        expect(calls).toContainEqual(["http://test-server/api/v1/projects/proj-1/cards/card-3/enhancement", "PUT"]);
        expect(calls).toContainEqual(["http://test-server/api/v1/projects/proj-1/tickets/enhance", "POST"]);
    });

    it("clears persisted enhancement on clearEnhancement", async () => {
        const fetchMock = vi.fn(async (url, options?: RequestInit) => {
            const href = url.toString();
            if (href.endsWith("/projects/proj-1/enhancements") && (!options || options.method === undefined)) {
                return new Response(JSON.stringify({ enhancements: { "card-4": { status: "ready" } } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (href.includes("/enhancement") && options?.method === "DELETE") {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            throw new Error(`Unexpected fetch ${href}`);
        });

        vi.spyOn(global, "fetch" as any).mockImplementation(fetchMock as any);

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(queue?.enhancements["card-4"]?.status).toBe("ready");
        });

        act(() => {
            queue!.clearEnhancement("card-4");
        });

        await waitFor(() => {
            expect(queue!.enhancements["card-4"]).toBeUndefined();
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://test-server/api/v1/projects/proj-1/cards/card-4/enhancement",
            expect.objectContaining({ method: "DELETE" }),
        );
    });

    it("clears state and shows a toast on enhancement failure", async () => {
        const fetchMock = vi.fn(async (url, options?: RequestInit) => {
            const href = url.toString();
            if (href.endsWith("/projects/proj-1/enhancements") && (!options || options.method === undefined)) {
                return new Response(JSON.stringify({ enhancements: {} }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (href.includes("/enhancement") && options?.method === "PUT") {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (href.includes("/tickets/enhance")) {
                return new Response(JSON.stringify({ error: "fail" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (href.includes("/enhancement") && options?.method === "DELETE") {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            throw new Error(`Unexpected fetch ${href}`);
        });

        vi.spyOn(global, "fetch" as any).mockImplementation(fetchMock as any);

        const queryClient = new QueryClient();
        let queue: ReturnType<typeof useTicketEnhancementQueue> | undefined;

        render(
            <QueryClientProvider client={queryClient}>
                <TestComponent onReady={(q) => (queue = q)} />
            </QueryClientProvider>,
        );

        await waitFor(() => expect(queue).toBeDefined());

        await act(async () => {
            await queue!.startEnhancementForExistingCard({
                projectId: "proj-1",
                cardId: "card-2",
                title: "Broken Title",
                description: "Broken Description",
            });
        });

        await waitFor(() => {
            expect(queue!.enhancements["card-2"]).toBeUndefined();
        });

        expect(toast).toHaveBeenCalled();
    });
});
