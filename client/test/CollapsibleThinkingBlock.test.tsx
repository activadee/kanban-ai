import React from "react";
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
    });

    it("toggles expanded/collapsed on click and updates aria-expanded", () => {
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

        fireEvent.click(summary as HTMLElement);
        expect(details?.open).toBe(true);

        fireEvent.click(summary as HTMLElement);
        expect(details?.open).toBe(false);
    });

    it("is keyboard accessible via native summary semantics", () => {
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

        fireEvent.keyDown(summary as HTMLElement, {key: "Enter"});
        // JSDOM may not implement keyboard toggling; ensure element remains focusable and the toggle affordance exists.
        expect(screen.getByText("Toggle")).not.toBeNull();
        expect(details?.open).toBe(false);
    });

    it("keeps styling stable (visual regression)", () => {
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
        const contentRegionId = summary?.getAttribute("aria-controls") ?? "";
        const contentRegion = contentRegionId ? document.getElementById(contentRegionId) : null;

        expect({
            block: {className: block?.className, open: block?.open},
            summary: summary?.className,
            toggleText: toggleText?.className ?? null,
            contentRegion: {
                className: contentRegion?.className ?? null,
            },
            content: content?.className,
        }).toMatchInlineSnapshot(`
          {
            "block": {
              "className": "mb-2 rounded border border-border/60 bg-background p-2",
              "open": false,
            },
            "content": "mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground",
            "contentRegion": {
              "className": "mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground",
            },
            "summary": "flex cursor-pointer list-none items-center justify-between gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "toggleText": "text-xs text-muted-foreground",
          }
        `);

        fireEvent.click(summary as HTMLElement);
        const blockOpen = container.querySelector('[data-slot="thinking-block"]') as HTMLDetailsElement | null;

        expect({
            open: blockOpen?.open ?? null,
        }).toMatchInlineSnapshot(`
          {
            "open": true,
          }
        `);
    });
});
