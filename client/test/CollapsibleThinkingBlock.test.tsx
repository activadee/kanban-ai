import {describe, it, expect, afterEach} from "vitest";
import {render, screen, fireEvent, cleanup, waitFor} from "@testing-library/react";

import {CollapsibleThinkingBlock} from "@/components/kanban/conversation/CollapsibleThinkingBlock";

describe("CollapsibleThinkingBlock", () => {
    afterEach(() => cleanup());

    it("defaults to collapsed and keeps content mounted", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const details = container.querySelector('details[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        expect(details).not.toBeNull();
        expect(details?.open).toBe(false);
        expect(details?.hasAttribute("open")).toBe(false);

        expect(screen.getByText("Toggle")).not.toBeNull();

        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content).not.toBeNull();
        expect(content?.textContent).toContain("first line");

        const summary = container.querySelector('summary[data-slot="thinking-summary"]') as HTMLElement | null;
        expect(summary).not.toBeNull();
        expect(summary?.getAttribute("aria-expanded")).toBe(null);
    });

    it("lets the <details> element control open state", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const details = container.querySelector('details[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(details).not.toBeNull();
        expect(content).not.toBeNull();

        const contentNode = content;

        details!.open = true;
        fireEvent(details!, new Event("toggle"));
        expect(details!.open).toBe(true);
        expect(container.querySelector('[data-slot="thinking-content"]')).toBe(contentNode);

        details!.open = false;
        fireEvent(details!, new Event("toggle"));
        expect(details!.open).toBe(false);
        expect(container.querySelector('[data-slot="thinking-content"]')).toBe(contentNode);
    });

    it("supports defaultOpen without controlling future toggles", async () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
                defaultOpen={true}
            />,
        );

        const details = container.querySelector('details[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        expect(details).not.toBeNull();

        await waitFor(() => {
            expect(details?.open).toBe(true);
        });

        details!.open = false;
        fireEvent(details!, new Event("toggle"));
        expect(details!.open).toBe(false);
    });

    it("keeps key styling hooks stable", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const block = container.querySelector('[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        const summary = container.querySelector('[data-slot="thinking-summary"]') as HTMLElement | null;
        const toggleText = container.querySelector('[data-slot="thinking-toggle"]') as HTMLSpanElement | null;
        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;

        expect(block?.className).toContain("rounded");
        expect(block?.className).toContain("border");
        expect(summary?.className).toContain("justify-between");
        expect(toggleText?.className).toContain("text-muted-foreground");
        expect(content?.className).toContain("mt-2");
        expect(content?.className).toContain("whitespace-pre-wrap");
    });
});
