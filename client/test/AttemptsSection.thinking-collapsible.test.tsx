import {describe, it, expect, afterEach, vi} from "vitest";
import {render, fireEvent, cleanup} from "@testing-library/react";
import type {Attempt, ConversationItem} from "shared";

import {AttemptsSection} from "@/components/kanban/card-inspector/sections/AttemptsSection";

describe("AttemptsSection – thinking blocks", () => {
    afterEach(() => cleanup());

    it("renders thinking blocks collapsed by default with grid animation", () => {
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
                pendingImages={[]}
                addImages={vi.fn()}
                removeImage={vi.fn()}
                canAddMoreImages={true}
            />,
        );

        const block = document.querySelector('[data-slot="thinking-block"]');
        const summary = document.querySelector('[data-slot="thinking-summary"]');
        const content = document.querySelector('[data-slot="thinking-content"]');

        expect(block).not.toBeNull();
        expect(summary).not.toBeNull();
        expect(content).not.toBeNull();

        expect(content?.className).toContain("opacity-0");
        expect(content?.className).toContain("grid-rows-[0fr]");

        fireEvent.click(summary!);

        expect(content?.className).toContain("opacity-100");
        expect(content?.className).toContain("grid-rows-[1fr]");
    });

    it("applies animation classes to typing indicator when attempt is running", () => {
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
                type: "message",
                timestamp: new Date().toISOString(),
                role: "user",
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
                pendingImages={[]}
                addImages={vi.fn()}
                removeImage={vi.fn()}
                canAddMoreImages={true}
            />,
        );

        const typingIndicator = document.querySelector('.agent-typing-indicator');
        expect(typingIndicator).not.toBeNull();
        expect(typingIndicator?.className).toContain("animate-in");
        expect(typingIndicator?.className).toContain("fade-in-50");
        expect(typingIndicator?.className).toContain("slide-in-from-bottom-2");
    });
});
