import React from "react";
import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {KanbanCard} from "@/components/kanban/Card";
import type {Card as TCard} from "shared";

describe("KanbanCard – GitHub issue badge", () => {
    const baseCard: TCard = {
        id: "card-1",
        title: "Test card",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ticketKey: "KA-1",
        ticketType: null,
        prUrl: null,
    };

    it("renders a #<issueNumber> badge when githubIssue is present", () => {
        const card: TCard = {
            ...baseCard,
            githubIssue: {
                issueNumber: 42,
                url: "https://github.com/owner/repo/issues/42",
            },
        };

        render(<KanbanCard card={card} />);

        const badgeLink = screen.getByText("#42") as HTMLAnchorElement;
        expect(badgeLink).not.toBeNull();
        expect(badgeLink.tagName.toLowerCase()).toBe("a");
        expect(badgeLink.href).toContain("/issues/42");
    });

    it("does not render the badge when githubIssue is absent", () => {
        render(<KanbanCard card={baseCard} />);
        expect(screen.queryByText(/^#/)).toBeNull();
    });
});
