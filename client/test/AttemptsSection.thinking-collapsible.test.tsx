import {describe, it, expect, afterEach, vi} from "vitest";
import {render, fireEvent, cleanup} from "@testing-library/react";
import type {Attempt, ConversationItem} from "shared";

import {AttemptsSection} from "@/components/kanban/card-inspector/sections/AttemptsSection";

describe("AttemptsSection – thinking blocks", () => {
    afterEach(() => cleanup());

    it("renders thinking blocks collapsed by default and relies on native <details> toggling", () => {
        const attempt: Attempt = {
            id: "att-1",
            cardId: "card-1",
            boardId: "board-1",
            agent: "agent-1",
            status: "running",
            baseBranch: "main",
            branchName: "feature/test",
            worktreePath: null,
            sessionId: null,
            startedAt: new Date().toISOString(),
            endedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const conversation: ConversationItem[] = [
            {
                type: "thinking",
                timestamp: new Date("2025-01-01T00:00:00.000Z").toISOString(),
                title: "Plan",
                text: "First line of thinking\nSecond line of thinking",
            },
            {
                type: "message",
                timestamp: new Date("2025-01-01T00:00:01.000Z").toISOString(),
                role: "assistant",
                text: "Hello",
            },
        ];

        render(
            <AttemptsSection
                attempt={attempt}
                cardId="card-1"
                locked={true}
                conversation={conversation}
                followup=""
                onFollowupChange={vi.fn()}
                onSendFollowup={vi.fn()}
                sendPending={false}
                stopping={false}
                onStopAttempt={vi.fn()}
                onProfileSelect={vi.fn()}
                followupProfiles={[]}
            />,
        );

        const details = document.querySelector('details[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        const summary = document.querySelector('summary[data-slot="thinking-summary"]') as HTMLElement | null;
        const content = document.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;

        expect(details).not.toBeNull();
        expect(summary).not.toBeNull();
        expect(content).not.toBeNull();
        expect(details?.open).toBe(false);

        details!.open = true;
        fireEvent(details!, new Event("toggle"));
        expect(details!.open).toBe(true);
        expect(document.querySelector('[data-slot="thinking-content"]')).toBe(content);
    });
});
