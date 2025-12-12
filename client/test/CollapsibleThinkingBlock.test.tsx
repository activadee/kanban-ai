import React from "react";
import {describe, it, expect, afterEach} from "vitest";
import {render, screen, fireEvent, cleanup} from "@testing-library/react";

import {CollapsibleThinkingBlock} from "@/components/kanban/conversation/CollapsibleThinkingBlock";

describe("CollapsibleThinkingBlock", () => {
    afterEach(() => cleanup());

    it("defaults to collapsed with a 1-line preview", () => {
        render(
            <CollapsibleThinkingBlock
                headerLeft={<span>thinking</span>}
                text={"first line\nsecond line"}
            />,
        );

        const toggle = screen.getByRole("button", {name: /expand thinking/i});
        expect(toggle.getAttribute("aria-expanded")).toBe("false");

        const preview = document.querySelector('[data-slot="thinking-preview"]') as HTMLDivElement | null;
        expect(preview).not.toBeNull();
        expect(preview?.className).toContain("line-clamp-1");

        const controls = toggle.getAttribute("aria-controls");
        expect(controls).toBeTruthy();
        const contentRegion = controls ? document.getElementById(controls) : null;
        expect(contentRegion?.getAttribute("aria-hidden")).toBe("true");
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
        expect(document.querySelector('[data-slot="thinking-preview"]')).toBeNull();

        const controls = toggle.getAttribute("aria-controls");
        const contentRegion = controls ? document.getElementById(controls) : null;
        expect(contentRegion?.getAttribute("aria-hidden")).toBe("false");

        const content = document.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        expect(content?.className).toContain("opacity-100");

        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(document.querySelector('[data-slot="thinking-preview"]')).not.toBeNull();
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
        const icon = button?.querySelector("svg") as SVGElement | null;
        const preview = container.querySelector('[data-slot="thinking-preview"]') as HTMLDivElement | null;
        const content = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        const contentRegionId = button?.getAttribute("aria-controls") ?? "";
        const contentRegion = contentRegionId ? document.getElementById(contentRegionId) : null;

        expect({
            block: block?.className,
            button: button?.className,
            icon: icon?.getAttribute("class") ?? null,
            preview: preview?.className,
            contentRegion: {
                ariaHidden: contentRegion?.getAttribute("aria-hidden") ?? null,
                className: contentRegion?.className ?? null,
            },
            content: content?.className,
        }).toMatchInlineSnapshot(`
          {
            "block": "group mb-2 rounded border border-dashed border-border/60 bg-muted/20 p-2",
            "button": "flex w-full cursor-pointer flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "content": "pt-2 whitespace-pre-wrap text-xs text-muted-foreground transition-opacity duration-200 opacity-0",
            "contentRegion": {
              "ariaHidden": "true",
              "className": "grid transition-[grid-template-rows] duration-200 ease-in-out grid-rows-[0fr]",
            },
            "icon": "lucide lucide-chevron-right size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            "preview": "mt-1 line-clamp-1 whitespace-pre-wrap break-words pl-6 text-xs text-muted-foreground",
          }
        `);

        fireEvent.click(button as HTMLButtonElement);
        const iconOpen = button?.querySelector("svg") as SVGElement | null;
        const contentOpen = container.querySelector('[data-slot="thinking-content"]') as HTMLDivElement | null;
        const contentRegionOpen = contentRegionId ? document.getElementById(contentRegionId) : null;

        expect({
            icon: iconOpen?.getAttribute("class") ?? null,
            preview: container.querySelector('[data-slot="thinking-preview"]'),
            contentRegion: {
                ariaHidden: contentRegionOpen?.getAttribute("aria-hidden") ?? null,
                className: contentRegionOpen?.className ?? null,
            },
            content: contentOpen?.className,
        }).toMatchInlineSnapshot(`
          {
            "content": "pt-2 whitespace-pre-wrap text-xs text-muted-foreground transition-opacity duration-200 opacity-100",
            "contentRegion": {
              "ariaHidden": "false",
              "className": "grid transition-[grid-template-rows] duration-200 ease-in-out grid-rows-[1fr]",
            },
            "icon": "lucide lucide-chevron-right size-4 shrink-0 text-muted-foreground transition-transform duration-200 rotate-90",
            "preview": null,
          }
        `);
    });
});
