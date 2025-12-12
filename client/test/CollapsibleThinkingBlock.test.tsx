import React from "react";
import {describe, it, expect, afterEach} from "vitest";
import {render, screen, fireEvent, cleanup} from "@testing-library/react";

import {CollapsibleThinkingBlock} from "@/components/kanban/conversation/CollapsibleThinkingBlock";

describe("CollapsibleThinkingBlock", () => {
    afterEach(() => cleanup());

    it("defaults to collapsed", () => {
        render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const toggle = screen.getByRole("button", {name: /expand thinking/i});
        expect(toggle.getAttribute("aria-expanded")).toBe("false");

        expect(document.querySelector('[data-slot="thinking-preview"]')).toBeNull();
        expect(screen.getByText("Toggle")).not.toBeNull();

        const controls = toggle.getAttribute("aria-controls");
        expect(controls).toBeTruthy();
        const contentRegion = controls ? document.getElementById(controls) : null;
        expect(contentRegion?.getAttribute("aria-hidden")).toBe("true");

        const content = document.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content?.className).toContain("opacity-0");
    });

    it("toggles expanded/collapsed on click and updates aria-expanded", () => {
        render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const toggle = screen.getByRole("button", {name: /expand thinking/i});
        fireEvent.click(toggle);

        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(toggle.getAttribute("aria-label")).toMatch(/collapse/i);

        const controls = toggle.getAttribute("aria-controls");
        const contentRegion = controls ? document.getElementById(controls) : null;
        expect(contentRegion?.getAttribute("aria-hidden")).toBe("false");

        const content = document.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content?.className).toContain("opacity-100");

        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(content?.className).toContain("opacity-0");
    });

    it("keeps styling stable (visual regression)", () => {
        const {container} = render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const block = container.querySelector('[data-slot="thinking-block"]') as HTMLDivElement | null;
        const button = container.querySelector("button") as HTMLButtonElement | null;
        const toggleText = container.querySelector('[data-slot="thinking-toggle"]') as HTMLSpanElement | null;
        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        const contentRegionId = button?.getAttribute("aria-controls") ?? "";
        const contentRegion = contentRegionId ? document.getElementById(contentRegionId) : null;

        expect({
            block: block?.className,
            button: button?.className,
            toggleText: toggleText?.className ?? null,
            contentRegion: {
                ariaHidden: contentRegion?.getAttribute("aria-hidden") ?? null,
                className: contentRegion?.className ?? null,
            },
            content: content?.className,
        }).toMatchInlineSnapshot(`
          {
            "block": "mb-2 rounded border border-border/60 bg-background p-2",
            "button": "flex w-full cursor-pointer list-none items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "content": "mt-2 whitespace-pre-wrap text-xs text-muted-foreground transition-opacity duration-200 opacity-0",
            "contentRegion": {
              "ariaHidden": "true",
              "className": "grid transition-[grid-template-rows] duration-200 ease-in-out grid-rows-[0fr]",
            },
            "toggleText": "text-xs text-muted-foreground",
          }
        `);

        fireEvent.click(button as HTMLButtonElement);
        const toggleTextOpen = container.querySelector('[data-slot="thinking-toggle"]') as HTMLSpanElement | null;
        const contentOpen = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        const contentRegionOpen = contentRegionId ? document.getElementById(contentRegionId) : null;

        expect({
            toggleText: toggleTextOpen?.className ?? null,
            contentRegion: {
                ariaHidden: contentRegionOpen?.getAttribute("aria-hidden") ?? null,
                className: contentRegionOpen?.className ?? null,
            },
            content: contentOpen?.className,
        }).toMatchInlineSnapshot(`
          {
            "content": "mt-2 whitespace-pre-wrap text-xs text-muted-foreground transition-opacity duration-200 opacity-100",
            "contentRegion": {
              "ariaHidden": "false",
              "className": "grid transition-[grid-template-rows] duration-200 ease-in-out grid-rows-[1fr]",
            },
            "toggleText": "text-xs text-muted-foreground",
          }
        `);
    });
});
