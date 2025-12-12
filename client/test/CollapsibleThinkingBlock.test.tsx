import {describe, it, expect, afterEach} from "vitest";
import {render, screen, fireEvent, cleanup} from "@testing-library/react";

import {CollapsibleThinkingBlock} from "@/components/kanban/conversation/CollapsibleThinkingBlock";

describe("CollapsibleThinkingBlock", () => {
    afterEach(() => cleanup());

    it("defaults to collapsed", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const details = container.querySelector('details[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        expect(details).not.toBeNull();
        expect(details?.open).toBe(false);

        expect(document.querySelector('[data-slot="thinking-preview"]')).toBeNull();
        expect(screen.getByText("Toggle")).not.toBeNull();

        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content).not.toBeNull();

        const summary = container.querySelector('summary[data-slot="thinking-summary"]') as HTMLElement | null;
        expect(summary?.getAttribute("aria-expanded")).toBe("false");
        expect(summary?.getAttribute("aria-describedby")).toBeTruthy();
    });

    it("toggles expanded/collapsed and updates aria-expanded", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const details = container.querySelector('details[data-slot="thinking-block"]') as HTMLDetailsElement | null;
        const summary = container.querySelector('summary[data-slot="thinking-summary"]') as HTMLElement | null;
        expect(details).not.toBeNull();
        expect(summary).not.toBeNull();

        details!.open = true;
        fireEvent(details!, new Event("toggle"));
        expect(summary?.getAttribute("aria-expanded")).toBe("true");

        details!.open = false;
        fireEvent(details!, new Event("toggle"));
        expect(summary?.getAttribute("aria-expanded")).toBe("false");
    });

    it("keeps a11y hint without overriding visible label", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking · Plan</span>}
                text={"first line\nsecond line"}
            />,
        );

        const summary = container.querySelector('summary[data-slot="thinking-summary"]') as HTMLElement | null;
        expect(summary).not.toBeNull();
        expect(summary?.getAttribute("aria-label")).toBe(null);
        expect(summary?.getAttribute("aria-describedby")).toBeTruthy();
        expect(container.querySelector('[data-slot="thinking-toggle"]')?.getAttribute("aria-hidden")).toBe("true");
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
        expect(content?.className).toContain("whitespace-pre-wrap");
    });
});
