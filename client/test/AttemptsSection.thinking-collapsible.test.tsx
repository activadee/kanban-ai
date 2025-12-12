import React from "react";
import {describe, it, expect, afterEach, vi} from "vitest";
import {render, screen, fireEvent, cleanup} from "@testing-library/react";
import type {Attempt, ConversationItem} from "shared";

import {AttemptsSection} from "@/components/kanban/card-inspector/sections/AttemptsSection";

describe("AttemptsSection – thinking blocks", () => {
    afterEach(() => cleanup());

    it("renders thinking blocks collapsed by default and toggles expanded", () => {
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

        const toggle = screen.getByRole("button", {name: /expand thinking/i});
        expect(toggle.getAttribute("aria-expanded")).toBe("false");

        expect(document.querySelector('[data-slot="thinking-preview"]')).toBeNull();
        expect(document.querySelector('[data-slot="thinking-content"]')?.className).toContain("opacity-0");

        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(document.querySelector('[data-slot="thinking-content"]')?.className).toContain("opacity-100");
    });
});
