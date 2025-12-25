import {describe, expect, it} from "vitest";

import {sanitizeResizablePanelsLayoutString} from "../src/components/ui/resizable";

describe("sanitizeResizablePanelsLayoutString", () => {
    it("returns null for invalid JSON", () => {
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                "{",
            ),
        ).toBeNull();
    });

    it("returns null for JSON values that aren't plain objects", () => {
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify([50, 50]),
            ),
        ).toBeNull();

        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify("oops"),
            ),
        ).toBeNull();
    });

    it("coerces numeric strings into numbers", () => {
        const raw = JSON.stringify({a: "50", b: "50"});
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                raw,
            ),
        ).toBe(JSON.stringify({a: 50, b: 50}));
    });

    it("trims whitespace around numeric strings", () => {
        const raw = JSON.stringify({a: " 50 ", b: "\n50\t"});
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                raw,
            ),
        ).toBe(JSON.stringify({a: 50, b: 50}));
    });

    it("returns null for empty or whitespace-only size strings", () => {
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify({a: "", b: "50"}),
            ),
        ).toBeNull();

        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify({a: "   ", b: "50"}),
            ),
        ).toBeNull();
    });

    it("returns null for out-of-range sizes", () => {
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify({a: 101, b: 50}),
            ),
        ).toBeNull();

        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify({a: -1, b: 50}),
            ),
        ).toBeNull();
    });

    it("returns null for forbidden layout keys", () => {
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                "{\"__proto__\":50,\"a\":50}",
            ),
        ).toBeNull();

        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                "{\"constructor\":50,\"a\":50}",
            ),
        ).toBeNull();

        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                "{\"prototype\":50,\"a\":50}",
            ),
        ).toBeNull();
    });

    it("returns null for non-numeric values", () => {
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify({a: "50%", b: "50"}),
            ),
        ).toBeNull();

        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                JSON.stringify({a: null, b: 50}),
            ),
        ).toBeNull();
    });

    it("preserves already-valid layouts", () => {
        const raw = JSON.stringify({a: 50, b: 50});
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                raw,
            ),
        ).toBe(raw);
    });

    it("flattens nested layout objects", () => {
        const raw = JSON.stringify({layout: {a: 50, b: 50}});
        expect(
            sanitizeResizablePanelsLayoutString(
                "react-resizable-panels:test",
                raw,
            ),
        ).toBe(JSON.stringify({a: 50, b: 50}));
    });

    it("passes through values for unrelated keys", () => {
        expect(sanitizeResizablePanelsLayoutString("other:key", "{not-json")).toBe(
            "{not-json",
        );
    });
});
