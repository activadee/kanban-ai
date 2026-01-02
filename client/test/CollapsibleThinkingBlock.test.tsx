import {describe, it, expect, afterEach} from "vitest";
import {render, fireEvent, cleanup} from "@testing-library/react";

import {CollapsibleThinkingBlock} from "@/components/kanban/conversation/CollapsibleThinkingBlock";

describe("CollapsibleThinkingBlock", () => {
    afterEach(() => cleanup());

    it("defaults to collapsed and keeps content mounted", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
            >
                {"first line\nsecond line"}
            </CollapsibleThinkingBlock>,
        );

        const block = container.querySelector('[data-slot="thinking-block"]') as HTMLDivElement | null;
        expect(block).not.toBeNull();

        const toggleContainer = container.querySelector('[data-slot="thinking-toggle"]') as HTMLSpanElement | null;
        expect(toggleContainer).not.toBeNull();
        expect(toggleContainer?.querySelector('svg')).not.toBeNull();

        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content).not.toBeNull();
        // Content is always mounted, just hidden with grid-rows-[0fr] and opacity-0
        expect(content?.textContent).toContain("first line");
        // When collapsed, should have opacity-0 class
        expect(content?.className).toContain("opacity-0");

        const summary = container.querySelector('[data-slot="thinking-summary"]') as HTMLElement | null;
        expect(summary).not.toBeNull();
    });

    it("toggles open state when clicked", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
            >
                {"first line\nsecond line"}
            </CollapsibleThinkingBlock>,
        );

        const block = container.querySelector('[data-slot="thinking-block"]') as HTMLDivElement | null;
        const summary = container.querySelector('[data-slot="thinking-summary"]') as HTMLButtonElement | null;
        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        
        expect(block).not.toBeNull();
        expect(summary).not.toBeNull();
        expect(content).not.toBeNull();

        // Initially collapsed
        expect(content?.className).toContain("opacity-0");
        expect(content?.className).toContain("grid-rows-[0fr]");

        // Click to open
        fireEvent.click(summary!);
        expect(content?.className).toContain("opacity-100");
        expect(content?.className).toContain("grid-rows-[1fr]");

        // Click to close
        fireEvent.click(summary!);
        expect(content?.className).toContain("opacity-0");
        expect(content?.className).toContain("grid-rows-[0fr]");
    });

    it("supports defaultOpen prop", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                defaultOpen={true}
            >
                {"first line\nsecond line"}
            </CollapsibleThinkingBlock>,
        );

        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content).not.toBeNull();
        
        // Should be open by default
        expect(content?.className).toContain("opacity-100");
        expect(content?.className).toContain("grid-rows-[1fr]");
    });

    it("keeps key styling hooks stable", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
            >
                {"first line\nsecond line"}
            </CollapsibleThinkingBlock>,
        );

        const block = container.querySelector('[data-slot="thinking-block"]') as HTMLDivElement | null;
        const summary = container.querySelector('[data-slot="thinking-summary"]') as HTMLElement | null;
        const toggleText = container.querySelector('[data-slot="thinking-toggle"]') as HTMLSpanElement | null;
        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;

        expect(block?.className).toContain("rounded");
        expect(block?.className).toContain("border");
        expect(summary?.className).toContain("justify-between");
        expect(toggleText?.className).toContain("text-muted-foreground");
        expect(content?.className).toContain("transition-all");
    });

    it("adds shadow when open", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                defaultOpen={true}
            >
                {"content"}
            </CollapsibleThinkingBlock>,
        );

        const block = container.querySelector('[data-slot="thinking-block"]') as HTMLDivElement | null;
        expect(block?.className).toContain("shadow-sm");
    });
});
